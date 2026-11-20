import assert from "node:assert/strict";
import { test } from "node:test";
import { colorFromName, familyFor, nameForHex } from "../src/catalog/colors.ts";
import { AESTHETICS, BANNED_WORDS, phrasesFor, RECIPES } from "../src/catalog/aesthetics.ts";
import { BODY, buildQueryPlan, styleWords, type DiscoverParams } from "../src/catalog/query.ts";

// Soft Autumn from frontend/src/data/seasons.ts, as the app sends it.
const softAutumn = {
  palette: ["#B07D62", "#9CAF88", "#C9A66B", "#7E8C6A", "#C48E7A", "#8DA399", "#D4B483", "#A5806A"],
  neutrals: ["#EDE4D8", "#C4B29B", "#8F7E6A", "#5C5046"],
};
const base: DiscoverParams = { category: "for-you", shopFor: "womens", style: "none", palette: [], neutrals: [] };

test("color names map to the longest known phrase, ignoring case and grey/gray", () => {
  assert.equal(colorFromName("Olive Green")?.name, "olive green");
  assert.equal(colorFromName("Space Black")?.name, "black");
  assert.equal(colorFromName("Charcoal Grey Crewneck Sweater")?.name, "charcoal gray");
  assert.equal(colorFromName("NAVY")?.name, "navy");
  assert.equal(colorFromName("10002-Off-White")?.name, "off white");
});

test("unknown names and look-alike words give no color", () => {
  assert.equal(colorFromName("Bering Sea"), null);
  assert.equal(colorFromName("Ribbed Tank Top"), null); // not "tan"
  assert.equal(colorFromName("Golden Hour Tee"), null); // not "gold"
  assert.equal(colorFromName("Denim Jacket"), null); // a fabric, not a color
});

test("a palette hex maps to the nearest searchable color name", () => {
  assert.equal(nameForHex("#556B2F"), "olive");
  assert.equal(nameForHex("#22304A"), "navy");
  assert.equal(nameForHex("#FFFFFF"), "white");
});

test("a category feed is one query in the shopper's department", () => {
  assert.deepEqual(buildQueryPlan({ ...base, category: "tops", shopFor: "mens" }), [{ query: "men's tops", category: "tops" }]);
  assert.deepEqual(buildQueryPlan({ ...base, category: "jeans", shopFor: "both" }), [{ query: "jeans", category: "jeans" }]);
});

test("search text narrows within the chosen category", () => {
  assert.deepEqual(buildQueryPlan({ ...base, category: "outerwear", q: "  wool " }), [
    { query: "women's wool jackets and coats", category: "outerwear" },
  ]);
  assert.deepEqual(buildQueryPlan({ ...base, q: "linen shirt" }), [{ query: "women's linen shirt", category: "for-you" }]);
});

test("men's dresses is an empty plan rather than a call that returns dress shirts", () => {
  assert.deepEqual(buildQueryPlan({ ...base, category: "dresses", shopFor: "mens" }), []);
});

test("For You is a small deterministic plan of palette colors on varied garments", () => {
  const plan = buildQueryPlan({ ...base, ...softAutumn });
  assert.ok(plan.length >= 4 && plan.length <= 8);
  assert.deepEqual(buildQueryPlan({ ...base, ...softAutumn }), plan);
  for (const step of plan) assert.match(step.query, /^women's /);
  const garments = plan.map((s) => s.query.split(" ").at(-1));
  for (let i = 1; i < garments.length; i++) assert.notEqual(garments[i], garments[i - 1]);
  assert.ok(new Set(plan.map((s) => s.category)).size >= 3, "spread across categories");
});

test("style changes which palette colors lead, not the palette", () => {
  const first = (style: DiscoverParams["style"]) => buildQueryPlan({ ...base, ...softAutumn, style })[0].query;
  assert.match(first("minimal"), /minimalist/);
  assert.match(first("minimal"), new RegExp(nameForHex(softAutumn.neutrals[0])));
  assert.match(first("dark"), new RegExp(nameForHex("#5C5046"))); // darkest color in the palette
  assert.match(first("colorful"), new RegExp(nameForHex("#C9A66B"))); // most saturated (Lab chroma 36)
});

test("without a palette For You still works from the style alone", () => {
  const plan = buildQueryPlan({ ...base, shopFor: "mens", style: "dark" });
  assert.ok(plan.length >= 4);
  for (const step of plan) assert.match(step.query, /^men's dark /);
});

test("each color word has the Shopify color family its filter understands", () => {
  assert.equal(familyFor("sage"), "Green");
  assert.equal(familyFor("camel"), "Brown");
  assert.equal(familyFor("off white"), "White");
  assert.equal(familyFor("dusty pink"), "Pink");
  assert.equal(familyFor("navy"), "Navy");
});

test("For You searches filter on the family of their color word; other feeds don't filter", () => {
  const plan = buildQueryPlan({ ...base, ...softAutumn });
  for (const step of plan) assert.equal(step.color, familyFor(colorFromName(step.query)!.name), step.query);
  assert.equal(buildQueryPlan({ ...base, category: "tops" })[0].color, undefined);
  assert.equal(buildQueryPlan({ ...base, q: "linen" })[0].color, undefined);
  assert.equal(buildQueryPlan({ ...base, style: "dark" })[0].color, undefined); // no palette
});

test("a seed varies For You: same seed, same plan; new seeds lead with other searches", () => {
  const seeded = (seed: number) => buildQueryPlan({ ...base, ...softAutumn, seed });
  assert.deepEqual(seeded(1), seeded(1));
  const leads = new Set(Array.from({ length: 10 }, (_, s) => seeded(s + 1).slice(0, 2).map((x) => x.query).join(" + ")));
  assert.ok(leads.size >= 6, `only ${leads.size} different first pages in 10 seeds`);
  for (const step of seeded(3)) {
    assert.ok(step.color, "every step still filters on a palette color family");
    assert.match(step.query, /^women's /);
  }
});

test("a seed turns a category tab into several varied searches of that category", () => {
  const tops = buildQueryPlan({ ...base, category: "tops", seed: 7 });
  assert.ok(tops.length >= 3);
  assert.equal(new Set(tops.map((s) => s.query)).size, tops.length);
  assert.ok(tops.every((s) => /^women's (\S+ )?tops$/.test(s.query) && s.category === "tops" && !s.color), JSON.stringify(tops));
  const orders = new Set([1, 2, 3, 4, 5].map((seed) => buildQueryPlan({ ...base, category: "tops", seed })[0].query));
  assert.ok(orders.size >= 3);
});

test("typed search text is never changed by the seed", () => {
  assert.deepEqual(buildQueryPlan({ ...base, category: "tops", q: "linen", seed: 9 }), buildQueryPlan({ ...base, category: "tops", q: "linen" }));
});

test("a category tab searches in the shopper's palette, each step on its color's filter", () => {
  const tops = buildQueryPlan({ ...base, ...softAutumn, category: "tops", seed: 7 });
  assert.ok(tops.length >= 3);
  for (const step of tops) {
    assert.match(step.query, /^women's .*tops$/);
    assert.equal(step.color, familyFor(colorFromName(step.query)!.name), step.query);
  }
  assert.ok(new Set(tops.map((s) => s.color)).size >= 2, "the steps walk through the palette");
});

test("the body steers style words: a fuller build skips cropped and clingy, avoiding beats favoring", () => {
  const fuller = styleWords("tops", ["fuller"]);
  for (const word of ["cropped", "fitted", "ribbed", "silk"].slice(0, 3)) assert.ok(!fuller.includes(word), word);
  assert.ok(fuller.filter((w) => w === "relaxed").length === 2, "favored words are listed twice");
  assert.ok(!styleWords("tops", ["petite", "fuller"]).includes("cropped"));
  assert.ok(styleWords("tops", ["petite"]).filter((w) => w === "cropped").length === 2);
  assert.ok(!styleWords("outerwear", ["petite"]).includes("oversized"));
  assert.deepEqual(styleWords("jeans"), styleWords("jeans", []));
});

test("For You and category plans never use a word the body avoids", () => {
  for (let seed = 1; seed <= 20; seed++) {
    for (const category of ["for-you", "tops", "outerwear"] as const) {
      const plan = buildQueryPlan({ ...base, ...softAutumn, category, seed, body: ["fuller"] });
      for (const step of plan) assert.ok(!/\b(cropped|fitted|slim|ribbed|slip|satin)\b/.test(step.query), step.query);
    }
  }
});

const looks = (extra: Partial<DiscoverParams> = {}) => buildQueryPlan({ ...base, ...softAutumn, seed: 5, ...extra });

test("without looks, or with only looks that have no searches, the plan is the plain one", () => {
  for (let seed = 1; seed <= 10; seed++) {
    const plain = buildQueryPlan({ ...base, ...softAutumn, seed });
    assert.deepEqual(buildQueryPlan({ ...base, ...softAutumn, seed, aesthetic: [] }), plain);
    assert.deepEqual(buildQueryPlan({ ...base, ...softAutumn, seed, aesthetic: ["casual"] }), plain);
    // Men's has no boho searches.
    assert.deepEqual(buildQueryPlan({ ...base, ...softAutumn, seed, shopFor: "mens", aesthetic: ["boho"] }), buildQueryPlan({ ...base, ...softAutumn, seed, shopFor: "mens" }));
  }
});

test("with looks, For You is 5 look searches, 1 exploring another look and 2 plain, in the plain plan's colors", () => {
  for (let seed = 1; seed <= 20; seed++) {
    const plan = looks({ seed, aesthetic: ["streetwear", "minimal"], avoid: ["romantic", "boho"] });
    const plain = buildQueryPlan({ ...base, ...softAutumn, seed });
    assert.equal(plan.length, 8);
    const sent = plan.filter((s) => s.aesthetic === "streetwear" || s.aesthetic === "minimal");
    const explored = plan.filter((s) => s.aesthetic && s.aesthetic !== "streetwear" && s.aesthetic !== "minimal");
    assert.equal(sent.length, 5, JSON.stringify(plan));
    assert.equal(explored.length, 1);
    assert.ok(!["romantic", "boho", "casual"].includes(explored[0].aesthetic!), String(explored[0].aesthetic));
    plan.forEach((step, i) => {
      if (!step.aesthetic) assert.deepEqual(step, plain[i], "plain steps match the plan without looks");
      else assert.equal(step.color, plain[i].color, "a look step keeps that step's palette color");
      assert.match(step.query, /^women's /);
    });
  }
});

test("looks are deterministic per seed and vary between seeds", () => {
  const params = { aesthetic: ["preppy" as const] };
  assert.deepEqual(looks({ ...params, seed: 3 }), looks({ ...params, seed: 3 }));
  const firsts = new Set([1, 2, 3, 4, 5, 6].map((seed) => looks({ ...params, seed })[0].query));
  assert.ok(firsts.size >= 3);
});

test("with looks, For You drops the minimalist style word; the style still orders the colors", () => {
  for (const step of looks({ style: "minimal", aesthetic: ["classic"] })) assert.doesNotMatch(step.query, /minimalist/);
});

test("with a style, a seeded feed rotates through only its 5 leading colors", () => {
  for (const style of ["dark", "colorful", "minimal"] as const) {
    const colors = new Set<string>();
    for (let seed = 1; seed <= 30; seed++) for (const step of buildQueryPlan({ ...base, ...softAutumn, style, seed })) colors.add(colorFromName(step.query)!.name);
    assert.ok(colors.size <= 5, `${style}: ${[...colors].join(", ")}`);
  }
  // The plain feed still walks the whole palette.
  const all = new Set<string>();
  for (let seed = 1; seed <= 30; seed++) for (const step of buildQueryPlan({ ...base, ...softAutumn, seed })) all.add(colorFromName(step.query)!.name);
  assert.ok(all.size > 5);
});

test("a category tab takes 2 of its 4 searches from the looks' phrases in that category", () => {
  const tops = looks({ category: "tops", shopFor: "mens", aesthetic: ["retro", "classic"] });
  assert.equal(tops.filter((s) => s.aesthetic).length, 2);
  for (const step of tops) assert.equal(step.category, "tops");
  // Jeans has no look phrases, so the tab is unchanged.
  assert.deepEqual(looks({ category: "jeans", aesthetic: ["streetwear"] }), looks({ category: "jeans" }));
  // Typed search text is never changed by looks.
  assert.deepEqual(looks({ q: "linen", aesthetic: ["streetwear"] }), looks({ q: "linen" }));
});

test("a shopper on both departments gets each look's women's and men's searches in turn", () => {
  const depts = looks({ shopFor: "both", aesthetic: ["preppy", "sporty"] })
    .filter((s) => s.aesthetic === "preppy" || s.aesthetic === "sporty")
    .map((s) => s.query.split(" ")[0]);
  assert.ok(depts.includes("women's") && depts.includes("men's"), depts.join());
  // Workwear is men's only.
  for (const step of looks({ shopFor: "both", aesthetic: ["workwear"] }).filter((s) => s.aesthetic === "workwear")) assert.match(step.query, /^men's /);
});

test("look searches never use a word the body avoids", () => {
  for (let seed = 1; seed <= 20; seed++) {
    for (const step of looks({ seed, body: ["petite"], aesthetic: ["streetwear"] })) assert.doesNotMatch(step.query, /oversized/, step.query);
    for (const step of looks({ seed, body: ["fuller"], aesthetic: ["romantic"] })) assert.doesNotMatch(step.query, /\bsatin\b/, step.query);
  }
});

test("every look keeps at least 3 searches whatever one body trait avoids", () => {
  const avoids: Record<string, string[]> = { petite: ["oversized"], tall: [], fuller: ["cropped", "fitted", "slim", "ribbed", "slip", "satin"], slender: [], "short-legs": [] };
  assert.deepEqual(Object.keys(avoids).sort(), [...BODY].sort(), "this table follows BODY_WORDS");
  for (const dept of ["womens", "mens"] as const) {
    for (const look of AESTHETICS) {
      if (!RECIPES[dept][look]) continue;
      assert.ok(phrasesFor(look, dept).length >= 5, `${dept} ${look} has 5 phrases`);
      for (const [trait, words] of Object.entries(avoids)) assert.ok(phrasesFor(look, dept, new Set(words)).length >= 3, `${dept} ${look} with ${trait}`);
    }
  }
});

test("recipes never search a banned word or a look's own name (boho and workwear are the tested exceptions)", () => {
  const banned = new RegExp(`\\b(${[...BANNED_WORDS, ...AESTHETICS.filter((a) => a !== "boho" && a !== "workwear")].join("|")})\\b`, "i");
  for (const dept of ["womens", "mens"] as const) {
    for (const [phrase] of Object.values(RECIPES[dept]).flat()) assert.doesNotMatch(phrase, banned, phrase);
  }
});
