import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeProduct } from "../src/catalog/normalize.ts";
import { bare, noUrl, productDetail, sweater, trouser } from "./fixtures/shopify.ts";

test("a full listing becomes the app's product, linked to the merchant's own page", () => {
  const p = normalizeProduct(trouser, "bottoms")!;
  assert.equal(p.id, "gid://shopify/p/AAA111");
  assert.equal(p.variantId, "gid://shopify/ProductVariant/5001");
  assert.equal(p.title, "Everyday Relaxed Trouser");
  assert.equal(p.url, trouser.variants[0].url);
  assert.deepEqual(p.merchant, { name: "Fernhill", url: "https://fernhill.example" });
  assert.deepEqual(p.image, { url: trouser.media[0].url, alt: "Olive relaxed trouser" });
  assert.equal(p.category, "bottoms");
  assert.equal(p.available, true);
  assert.deepEqual(p.rating, { value: 4.6, max: 5, count: 120 });
});

test("prices come from minor units in the listing's own currency", () => {
  assert.deepEqual(normalizeProduct(trouser)!.price, { minor: 8900, currency: "USD", formatted: "$89.00" });
  // JPY has no minor unit, so 120050 is ¥120,050.
  assert.deepEqual(normalizeProduct(sweater)!.price, { minor: 120050, currency: "JPY", formatted: "¥120,050" });
  assert.equal(normalizeProduct(bare)!.price, null);
});

test("the color is the shown variant's merchant label, with an approximate swatch", () => {
  assert.deepEqual(normalizeProduct(trouser)!.color, { name: "Olive Green", hex: "#6B7A3A", source: "variant" });
});

test("without a color option the color is read from the title, and says so", () => {
  const c = normalizeProduct(sweater)!.color!;
  assert.equal(c.source, "title");
  assert.equal(c.name, "charcoal gray");
});

test("a color name the table doesn't know keeps the name but invents no swatch", () => {
  assert.deepEqual(normalizeProduct(bare)!.color, { name: "Sea Spray", hex: null, source: "variant" });
});

test("sizes are the merchant's size options; other options are kept as listed", () => {
  const p = normalizeProduct(trouser)!;
  assert.deepEqual(p.sizes, ["30\"", "32\""]);
  assert.deepEqual(
    p.options.map((o) => o.name),
    ["Color", "Waist size", "Inseam length"],
  );
});

test("missing images and unavailable stock are reported, not hidden", () => {
  const p = normalizeProduct(bare)!;
  assert.equal(p.image, null);
  assert.equal(p.available, false);
  assert.equal(p.merchant.name, "Tide");
});

test("listings with no merchant URL or no id are dropped instead of guessing a link", () => {
  assert.equal(normalizeProduct(noUrl), null);
  assert.equal(normalizeProduct({ ...trouser, id: undefined }), null);
  assert.equal(normalizeProduct("nonsense"), null);
});

test("detail adds every image, plain-text description, variants and the selected options", () => {
  const p = normalizeProduct(productDetail, undefined, { detail: true })!;
  assert.equal(p.images?.length, 2);
  assert.equal(p.description, "Relaxed fit & drawstring waist.");
  assert.equal(p.variants?.length, 2);
  assert.deepEqual(p.variants?.[1], {
    id: "gid://shopify/ProductVariant/5005",
    title: "Everyday Relaxed Trouser - Space Black",
    url: "https://fernhill.example/products/everyday-relaxed-trouser?variant=5005",
    price: { minor: 8900, currency: "USD", formatted: "$89.00" },
    available: false,
    options: [
      { name: "Waist size", label: "30\"" },
      { name: "Color", label: "Space Black" },
    ],
  });
  assert.deepEqual(p.options[0].values, [
    { label: "Olive Green", available: true },
    { label: "Space Black", available: false },
  ]);
  assert.deepEqual(p.selected, productDetail.selected);
});

test("feed products stay small: no description, gallery or variant list", () => {
  const p = normalizeProduct(trouser)!;
  assert.equal(p.description, undefined);
  assert.equal(p.images, undefined);
  assert.equal(p.variants, undefined);
  assert.deepEqual(p.selected, trouser.variants[0].options);
});
