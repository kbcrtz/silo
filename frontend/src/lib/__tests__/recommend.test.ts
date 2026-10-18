import { CATALOG, findItem } from "@/data/catalog";
import { SEASONS } from "@/data/seasons";
import {
  bodyHalfAt,
  bodyOutlines,
  garmentOutlines,
  hemY,
  landmarks,
  outfit,
} from "../mannequin";
import { recommend } from "../recommend";
import { silhouetteMatch } from "../silhouette";

describe("silhouetteMatch", () => {
  it("favors waist-defining cuts for an hourglass", () => {
    expect(silhouetteMatch("wrap", "hourglass").score).toBeGreaterThan(
      silhouetteMatch("boxy", "hourglass").score,
    );
    expect(silhouetteMatch("wrap", "hourglass").label).toBe(
      "Flatters your shape",
    );
  });

  it("balances a pear with volume below", () => {
    expect(silhouetteMatch("a-line", "pear").score).toBe(100);
    expect(silhouetteMatch("slim", "pear").label).toBe("Less flattering");
  });
});

describe("recommend", () => {
  const season = SEASONS["soft-autumn"];

  it("sorts best first and blends both scores", () => {
    const ranked = recommend(CATALOG, season, "pear");
    for (let i = 1; i < ranked.length; i++)
      expect(ranked[i - 1].score).toBeGreaterThanOrEqual(ranked[i].score);
    const r = ranked[0];
    expect(r.score).toBe(
      Math.round(0.6 * r.color!.score + 0.4 * r.silhouette!.score),
    );
  });

  it("uses whichever half exists", () => {
    const colorOnly = recommend(CATALOG, season, null);
    expect(colorOnly[0].silhouette).toBeUndefined();
    expect(colorOnly[0].score).toBe(colorOnly[0].color!.score);

    const cutOnly = recommend(CATALOG, null, "hourglass");
    expect(cutOnly[0].color).toBeUndefined();
    expect(cutOnly[0].score).toBe(cutOnly[0].silhouette!.score);
  });

  it("puts a silhouette that suits the shape ahead of the same color in a worse cut", () => {
    const a = { ...findItem("w-10")!, id: "a", silhouette: "a-line" as const };
    const b = { ...a, id: "b", silhouette: "slim" as const };
    const ranked = recommend([b, a], season, "pear");
    expect(ranked.map((r) => r.item.id)).toEqual(["a", "b"]);
  });
});

describe("mannequin", () => {
  const L = landmarks(
    {
      height: 168,
      chest: 90,
      waist: 71,
      hips: 99,
      inseam: 78,
      armLength: 58,
    },
    "womens",
  );

  it("puts the crotch at height minus inseam and keeps landmarks in order", () => {
    expect(L.y.crotch).toBe(90);
    const order = [
      L.y.chin,
      L.y.neck,
      L.y.shoulder,
      L.y.armpit,
      L.y.chest,
      L.y.waist,
      L.y.hip,
      L.y.crotch,
      L.y.knee,
      L.y.ankle,
    ];
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it("is widest at the hips for a pear and narrowest at the waist", () => {
    const pear = landmarks({ chest: 86, waist: 70, hips: 104 }, "womens");
    expect(bodyHalfAt(pear, pear.y.hip)).toBeGreaterThan(
      bodyHalfAt(pear, pear.y.chest),
    );
    expect(bodyHalfAt(pear, pear.y.waist)).toBeLessThan(
      bodyHalfAt(pear, pear.y.chest),
    );
  });

  it("fills unmeasured values from a figure scaled to the height", () => {
    const tall = landmarks({ height: 190 }, "mens");
    const avg = landmarks({}, "mens");
    expect(tall.half.chest).toBeGreaterThan(avg.half.chest);
  });

  it("is symmetric", () => {
    const { silhouette, head } = bodyOutlines(L);
    for (const outline of [silhouette, head]) {
      const xs = outline.map((p) => p.x).sort((a, b) => a - b);
      expect(xs[0]).toBeCloseTo(-xs[xs.length - 1]);
    }
  });

  it("opens the arms far enough to clear wide hips", () => {
    const narrow = landmarks({ chest: 88, waist: 70, hips: 94 }, "womens");
    const wide = landmarks({ chest: 82, waist: 72, hips: 118 }, "womens");
    expect(wide.arm.spread).toBeGreaterThan(narrow.arm.spread);
    for (const t of [0.5, 1]) {
      const inner = wide.arm.point(t, -wide.arm.half(t));
      expect(inner.x).toBeGreaterThan(wide.halfAt(inner.y));
    }
  });

  it("builds a finite outline for every catalog item", () => {
    for (const item of CATALOG) {
      const g = garmentOutlines(L, item);
      expect(g.parts.length).toBeGreaterThan(0);
      for (const shape of [...g.parts, ...g.lines, ...g.folds])
        for (const p of shape)
          expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
    }
  });

  it("completes the outfit around the item", () => {
    const roles = (id: string) =>
      outfit(L, findItem(id)!).map((layer) => layer.role);
    expect(roles("w-03")).toEqual(["item"]); // dress
    expect(roles("w-06")).toEqual(["baseTop", "item"]); // trousers
    expect(roles("w-01")).toEqual(["baseBottom", "item"]); // shirt
    expect(roles("w-09")).toEqual(["baseBottom", "baseTop", "item"]); // blazer
  });

  it("drops the hem lower for longer lengths", () => {
    expect(hemY(L, "waist")).toBeLessThan(hemY(L, "hip"));
    expect(hemY(L, "hip")).toBeLessThan(hemY(L, "knee"));
    expect(hemY(L, "knee")).toBeLessThan(hemY(L, "midi"));
    expect(hemY(L, "midi")).toBeLessThan(hemY(L, "ankle"));
  });
});
