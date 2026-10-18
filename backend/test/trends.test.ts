import assert from "node:assert/strict";
import { test } from "node:test";
import { familyOfHex, isPopular, pickTrending } from "../src/services/trends.ts";

const row = (item_id: string, garment: string | null, silhouette: string | null, color_family: string | null, score: number) => ({
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
    row("shopify-A", "top", "relaxed", "Green", 9),
    row("shopify-B", "top", "relaxed", "Green", 4),
    row("shopify-C", "bottom", "wide-leg", "Brown", 5),
    row("w-01", "top", "fitted", "Pink", 1),
  ]);
  assert.deepEqual(t.items.slice(0, 2), ["shopify-A", "shopify-C"]);
  assert.deepEqual(t.traits[0], { garment: "top", silhouette: "relaxed", family: "Green" }); // A + B = 13
  assert.deepEqual(t.traits[1], { garment: "bottom", silhouette: "wide-leg", family: "Brown" });
});

test("rows missing a trait still count for their item, not for a combination", () => {
  const t = pickTrending([row("shopify-A", null, null, null, 3)]);
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
