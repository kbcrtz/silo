import assert from "node:assert/strict";
import { test } from "node:test";
import { colorFromName, nameForHex } from "../src/catalog/colors.ts";
import { buildQueryPlan, type DiscoverParams } from "../src/catalog/query.ts";

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
