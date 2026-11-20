import type { Aesthetic } from "@/data/aesthetics";
import type { StatedTaste } from "../taste";
import {
  affinities,
  credit,
  decay,
  dismiss,
  emptyLearned,
  feedOrder,
  MAX_LEDGER,
  noteOverrule,
  noWaivers,
  pickLooks,
  restoreRule,
  retract,
  softHidden,
  tasteModel,
  tasteReason,
  tasteScore,
  WAIVE_AFTER,
  type Learned,
  type Ledger,
  type Tagged,
} from "../tasteLearn";

const NOW = new Date("2026-11-19T12:00:00Z");
const days = (n: number) => new Date(NOW.getTime() + n * 86_400_000);
const item = (id: string, aesthetics: Aesthetic[], garment?: string): Tagged => ({
  id,
  aesthetics,
  garment,
});
const stated = (patch: Partial<StatedTaste> = {}): StatedTaste => ({
  liked: [],
  rejected: [],
  colorStyle: "none",
  via: "onboarding",
  at: NOW.toISOString(),
  ...patch,
});
/** Applies several signals in order. */
function run(
  steps: [Tagged, Parameters<typeof credit>[3]][],
  start: Learned = emptyLearned(NOW),
) {
  let learned = start;
  let ledger: Ledger = {};
  for (const [i, s] of steps) ({ learned, ledger } = credit(learned, ledger, i, s, NOW));
  return { learned, ledger };
}
const fixedRandom = (x: number) => () => x;

describe("credit", () => {
  it("only the strongest action per item counts: open, save, shop is 5, not 9", () => {
    const hoodie = item("h", ["streetwear"], "hoodie");
    const { learned } = run([
      [hoodie, "open"],
      [hoodie, "save"],
      [hoodie, "shop"],
      [hoodie, "open"],
    ]);
    expect(learned.aesthetic.streetwear).toEqual({ p: 5, n: 0 });
    expect(learned.garment.hoodie).toEqual({ p: 5, n: 0 });
  });

  it("two look tags split the points", () => {
    const { learned } = run([[item("x", ["minimal", "classic"]), "save"]]);
    expect(learned.aesthetic.minimal?.p).toBe(1.5);
    expect(learned.aesthetic.classic?.p).toBe(1.5);
  });

  it("an item with no tags credits nothing but is still in the ledger", () => {
    const { learned, ledger } = run([[item("blank", []), "save"]]);
    expect(learned.aesthetic).toEqual({});
    expect(ledger.blank).toBe(3);
  });

  it("the ledger keeps only the newest items", () => {
    const steps = Array.from(
      { length: MAX_LEDGER + 10 },
      (_, i) => [item(`i${i}`, ["casual"]), "open"] as [Tagged, "open"],
    );
    const { ledger } = run(steps);
    expect(Object.keys(ledger)).toHaveLength(MAX_LEDGER);
    expect(ledger.i0).toBeUndefined();
    expect(ledger[`i${MAX_LEDGER + 9}`]).toBe(1);
  });
});

describe("retract", () => {
  it("unsaving takes back exactly what the item gave", () => {
    const tee = item("t", ["streetwear"], "tee");
    const saved = run([[tee, "save"]]);
    const after = retract(saved.learned, saved.ledger, tee, NOW);
    expect(after.learned.aesthetic.streetwear).toEqual({ p: 0, n: 0 });
    expect(after.ledger.t).toBeUndefined();
  });

  it("does nothing for an item that gave nothing", () => {
    const { learned, ledger } = run([]);
    expect(retract(learned, ledger, item("x", ["boho"]), NOW).learned).toBe(learned);
  });
});

describe("decay", () => {
  it("halves counters every 30 days and drops tiny ones", () => {
    const { learned } = run([[item("a", ["boho"], "skirt"), "shop"]]);
    expect(decay(learned, days(30)).aesthetic.boho?.p).toBeCloseTo(2.5);
    expect(decay(learned, days(300)).aesthetic.boho).toBeUndefined();
  });

  it("never grows counters when the clock goes backwards", () => {
    const { learned } = run([[item("a", ["boho"]), "save"]]);
    expect(decay(learned, days(-10)).aesthetic.boho?.p).toBe(3);
  });
});

describe("affinities", () => {
  it("stay within -1..1 however much one value is used", () => {
    const a = affinities({ streetwear: { p: 500, n: 0 }, minimal: { p: 1, n: 0 } }, 4);
    expect(a.streetwear).toBeLessThanOrEqual(1);
    expect(a.minimal).toBeGreaterThanOrEqual(-1);
  });

  it("shrink a single action toward the average, far below a look with many saves", () => {
    const a = affinities({ boho: { p: 1, n: 0 }, streetwear: { p: 30, n: 0 } }, 4);
    expect(a.boho).toBeLessThan(0.2);
    expect(a.streetwear).toBeGreaterThan(a.boho + 0.3);
  });
});

describe("tasteModel", () => {
  it("a stated like or dislike is worth ±0.5 before any behavior", () => {
    const m = tasteModel(stated({ liked: ["boho"], rejected: ["edgy"] }), undefined);
    expect(m.look.boho).toBe(0.5);
    expect(m.look.edgy).toBe(-0.5);
    expect(m.look.minimal).toBe(0);
    expect(m.disliked.has("edgy")).toBe(true);
  });

  it("100 saves in one look never make the others disliked", () => {
    const steps = Array.from(
      { length: 100 },
      (_, i) => [item(`s${i}`, ["streetwear"]), "save"] as [Tagged, "save"],
    );
    const { learned } = run([...steps, [item("m", ["minimal"]), "open"]]);
    const m = tasteModel(undefined, learned);
    expect(m.look.streetwear).toBeLessThanOrEqual(1);
    expect(m.disliked.size).toBe(0);
  });

  it("a look is disliked once dismissed and mostly turned down", () => {
    let { learned } = run([]);
    learned = dismiss(learned, item("r", ["romantic"], "blouse"), NOW);
    const m = tasteModel(undefined, learned);
    expect(m.disliked.has("romantic")).toBe(true);
    // A look they also said they like is never disliked.
    expect(tasteModel(stated({ liked: ["romantic"] }), learned).disliked.has("romantic")).toBe(false);
  });
});

describe("tasteScore and softHidden", () => {
  const { learned } = run([
    [item("1", ["streetwear"], "cargo pants"), "shop"],
    [item("2", ["streetwear"], "hoodie"), "save"],
    [item("3", ["minimal"], "tee"), "open"],
  ]);
  const model = tasteModel(stated({ rejected: ["romantic"] }), learned);

  it("lifts a liked look, is 0 for an item with no tags", () => {
    expect(tasteScore(item("a", ["streetwear"], "cargo pants"), model)).toBeGreaterThan(0.3);
    expect(tasteScore(item("b", []), model)).toBe(0);
  });

  it("sends a turned-down look to the end unless the item also has a look they like", () => {
    expect(softHidden(item("c", ["romantic"]), model)).toBe(true);
    expect(softHidden(item("d", ["romantic", "streetwear"]), model)).toBe(false);
  });

  it("one dismissal moves another item's score by at most its shared dimensions' weight", () => {
    const blouse = item("b1", ["casual"], "blouse");
    const other = item("b2", ["classic"], "blouse");
    const before = tasteScore(other, tasteModel(undefined, learned));
    const after = tasteScore(other, tasteModel(undefined, dismiss(learned, blouse, NOW)));
    // They share only the garment, which is 0.4 of the score.
    expect(Math.abs(after - before)).toBeLessThanOrEqual(0.4);
  });
});

describe("feedOrder", () => {
  const ids = Array.from({ length: 12 }, (_, i) => i);
  it("keeps order when nothing stands out", () => {
    expect(feedOrder(ids, () => ({ fit: 100, taste: 0, hidden: false }))).toEqual(ids);
  });

  it("lifts a liked item up to 8 places; a tie keeps the item that was there first", () => {
    const out = feedOrder(ids, (i) => ({ fit: 100, taste: i === 10 ? 1 : 0, hidden: false }));
    expect(out.indexOf(10)).toBe(3);
  });

  it("still sinks a poor fit, and sends a hidden look to the end", () => {
    const out = feedOrder(ids, (i) => ({ fit: i === 0 ? 10 : 100, taste: 0, hidden: i === 1 }));
    expect(out.indexOf(0)).toBeGreaterThan(5);
    expect(out.at(-1)).toBe(1);
  });

  it("fit outweighs taste: a perfect-taste item that fits badly doesn't rise", () => {
    const out = feedOrder(ids, (i) => (i === 5 ? { fit: 0, taste: 1, hidden: false } : { fit: 100, taste: 0, hidden: false }));
    expect(out.indexOf(5)).toBeGreaterThanOrEqual(5);
  });
});

describe("pickLooks", () => {
  it("sends nothing before any taste is known", () => {
    expect(pickLooks(tasteModel(undefined, undefined), "womens", fixedRandom(0.5))).toEqual({
      aesthetic: [],
      avoid: [],
    });
  });

  it("stated likes lead in the order picked; the third slot explores", () => {
    const m = tasteModel(stated({ liked: ["preppy", "boho", "minimal"] }), undefined);
    const { aesthetic } = pickLooks(m, "womens", fixedRandom(0.999));
    expect(aesthetic.slice(0, 2)).toEqual(["preppy", "boho"]);
    expect(aesthetic).toHaveLength(3);
  });

  it("never sends casual, a look the department lacks, or a disliked look; avoids the disliked", () => {
    const m = tasteModel(stated({ liked: ["casual", "workwear", "boho"], rejected: ["edgy"] }), undefined);
    for (const r of [0, 0.3, 0.6, 0.99]) {
      const { aesthetic, avoid } = pickLooks(m, "womens", fixedRandom(r));
      expect(aesthetic).not.toContain("casual");
      expect(aesthetic).not.toContain("workwear");
      expect(aesthetic).not.toContain("edgy");
      expect(avoid).toEqual(["edgy"]);
    }
  });

  it("learned taste alone is enough to steer", () => {
    const { learned } = run([
      [item("1", ["workwear"], "jacket"), "shop"],
      [item("2", ["workwear"], "pants"), "save"],
      [item("3", ["classic"]), "open"],
    ]);
    const { aesthetic } = pickLooks(tasteModel(undefined, learned), "mens", fixedRandom(0));
    expect(aesthetic[0]).toBe("workwear");
  });
});

describe("tasteReason", () => {
  it("needs real evidence before it says anything", () => {
    const one = run([[item("1", ["boho"]), "open"]]);
    expect(tasteReason(item("x", ["boho"]), tasteModel(undefined, one.learned))).toBeNull();
    const many = run([
      [item("1", ["boho"]), "save"],
      [item("2", ["boho"]), "shop"],
      [item("3", ["minimal"]), "open"],
    ]);
    expect(tasteReason(item("x", ["boho"]), tasteModel(undefined, many.learned))).toBe(
      "In the boho look you keep coming back to",
    );
  });
});

describe("waivers", () => {
  const rule = "A cropped hem lands on the midsection";

  it(`waive a rule after ${WAIVE_AFTER} different pieces it sinks are saved`, () => {
    let w = noWaivers;
    w = noteOverrule(w, "a", [rule]);
    w = noteOverrule(w, "a", [rule]);
    w = noteOverrule(w, "b", [rule]);
    expect(w.waived).toEqual([]);
    w = noteOverrule(w, "c", [rule]);
    expect(w.waived).toEqual([rule]);
    expect(w.hits[rule]).toBeUndefined();
  });

  it("turning a rule back on starts its count over", () => {
    let w = { hits: {}, waived: [rule] };
    w = restoreRule(w, rule);
    expect(w.waived).toEqual([]);
    expect(noteOverrule(w, "d", [rule]).waived).toEqual([]);
  });
});

describe("the backed-up taste stays small", () => {
  it("full counters fit far under the 32 KB profile limit", () => {
    let learned = emptyLearned(NOW);
    let ledger: Ledger = {};
    for (let i = 0; i < 500; i++) {
      ({ learned, ledger } = credit(learned, ledger, item(`i${i}`, ["streetwear", "minimal"], `garment-${i}`), "save", NOW));
    }
    learned = decay(learned, NOW);
    expect(Object.keys(learned.garment).length).toBeLessThanOrEqual(40);
    expect(JSON.stringify(learned).length).toBeLessThan(4 * 1024);
  });
});

describe("noteOverrule stays put when nothing changes", () => {
  it("returns the same waivers for no sinking rules, a waived rule or a repeat item", () => {
    const w = { hits: { r: ["a"] }, waived: ["done"] };
    expect(noteOverrule(w, "b", [])).toBe(w);
    expect(noteOverrule(w, "b", ["done"])).toBe(w);
    expect(noteOverrule(w, "a", ["r"])).toBe(w);
    const next = noteOverrule(w, "b", ["r"]);
    expect(next).not.toBe(w);
    expect(next.waived).toBe(w.waived);
  });
});

describe("looks this app version doesn't know", () => {
  it("never become a taste reason", () => {
    const learned = {
      ...emptyLearned(new Date()),
      aesthetic: { cottagecore: { p: 9, n: 0 } },
    } as unknown as Learned;
    expect(
      tasteReason(
        { id: "x", aesthetics: ["cottagecore" as Aesthetic] },
        tasteModel(undefined, learned),
      ),
    ).toBeNull();
  });
});
