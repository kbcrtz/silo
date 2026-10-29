import assert from "node:assert/strict";
import { test } from "node:test";
import { familyOfHex, isPopular, pickTrending } from "../src/services/trends.ts";

const row = (voter: string, item_id: string, garment: string | null, silhouette: string | null, color_family: string | null, score: number) => ({
  voter,
  item_id,
  garment,
  silhouette,
  color_family,
  score,
});

test("a hex swatch maps to the Shopify color family nearest to it", () => {
  assert.equal(familyOfHex("#9CAF88"), "Green");
  assert.equal(familyOfHex("#C19A6B"), "Brown");
  assert.equal(familyOfHex("#FAF9F6"), "White");
  assert.equal(familyOfHex("nope"), null);
});

test("trending keeps the top items and the top garment + cut + color combinations", () => {
  const t = pickTrending([
    row("u1", "shopify-A", "top", "relaxed", "Green", 5),
    row("u2", "shopify-A", "top", "relaxed", "Green", 5),
    row("u3", "shopify-B", "top", "relaxed", "Green", 3),
    row("u1", "shopify-C", "bottom", "wide-leg", "Brown", 3),
    row("u2", "shopify-C", "bottom", "wide-leg", "Brown", 3),
    row("u1", "w-01", "top", "fitted", "Pink", 1),
    row("u2", "w-01", "top", "fitted", "Pink", 1),
  ]);
  assert.deepEqual(t.items, ["shopify-A", "shopify-C"]); // B has one voter; w-01 has 2 points
  assert.deepEqual(t.traits, [
    { garment: "top", silhouette: "relaxed", family: "Green" }, // u1 5 + u2 5 + u3 3
    { garment: "bottom", silhouette: "wide-leg", family: "Brown" },
  ]);
});

test("one user alone can't make an item or a combination popular, however often they tap", () => {
  const t = pickTrending([
    row("u1", "shopify-A", "top", "relaxed", "Green", 5),
    row("u1", "shopify-A", null, null, null, 3),
    row("u1", "shopify-B", "top", "relaxed", "Green", 5),
  ]);
  assert.deepEqual(t, { items: [], traits: [] });
});

test("each user counts once per item, at their strongest action", () => {
  // u1's shop and save on A are 5, not 8: with u2's open that's 6, just enough.
  const rows = [row("u1", "shopify-A", null, null, null, 5), row("u1", "shopify-A", "top", "relaxed", "Green", 3)];
  assert.deepEqual(pickTrending([...rows, row("u2", "shopify-A", null, null, null, 1)]).items, ["shopify-A"]);
  assert.deepEqual(pickTrending([row("u1", "shopify-A", null, null, null, 3), row("u2", "shopify-A", null, null, null, 1)]).items, []);
});

test("rows missing a trait still count for their item, not for a combination", () => {
  const t = pickTrending([row("u1", "shopify-A", null, null, null, 3), row("u2", "shopify-A", null, null, null, 3)]);
  assert.deepEqual(t.items, ["shopify-A"]);
  assert.deepEqual(t.traits, []);
});

test("a product is popular by its own id or by a trending combination", () => {
  const t = { items: ["shopify-A"], traits: [{ garment: "top", silhouette: "relaxed", family: "Green" }] };
  assert.equal(isPopular({ itemId: "shopify-A" }, t), true);
  assert.equal(isPopular({ itemId: "shopify-Z", garment: "top", silhouette: "relaxed", family: "Green" }, t), true);
  assert.equal(isPopular({ itemId: "shopify-Z", garment: "top", silhouette: "fitted", family: "Green" }, t), false);
  assert.equal(isPopular({ itemId: "shopify-Z" }, { items: [], traits: [] }), false);
});
