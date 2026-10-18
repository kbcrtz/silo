import type { CatalogProduct } from "@/api/catalog";
import { findItem, rememberItems } from "@/data/catalog";
import { SEASONS } from "@/data/seasons";
import { inferCut, toCatalogItem } from "../liveItem";
import { garmentOutlines, landmarks } from "../mannequin";
import { recommend } from "../recommend";

const product = (patch: Partial<CatalogProduct> = {}): CatalogProduct => ({
  id: "gid://shopify/p/AAA111",
  variantId: "gid://shopify/ProductVariant/5001",
  title: "Everyday Relaxed Trouser",
  url: "https://fernhill.example/products/everyday-relaxed-trouser?variant=5001",
  merchant: { name: "Fernhill" },
  image: { url: "https://cdn.shopify.com/trouser.jpg", alt: "Olive trouser" },
  price: { minor: 8950, currency: "USD", formatted: "$89.50" },
  category: "bottoms",
  color: { name: "Olive Green", hex: "#6B7A3A", source: "variant" },
  options: [],
  sizes: ["30", "32"],
  selected: [],
  available: true,
  ...patch,
});

describe("inferCut", () => {
  it.each([
    [
      "Everyday Relaxed Trouser",
      undefined,
      { category: "bottom", silhouette: "straight", length: "ankle" },
    ],
    [
      "High Rise Wide Leg Jean",
      undefined,
      { category: "bottom", silhouette: "wide-leg", length: "ankle" },
    ],
    [
      "Off White Linen Wide Trousers",
      undefined,
      { category: "bottom", silhouette: "wide-leg", length: "ankle" },
    ],
    [
      "Linen Drawstring Shorts",
      undefined,
      { category: "bottom", length: "thigh" },
    ],
    [
      "Satin Midi Slip Dress",
      undefined,
      { category: "dress", silhouette: "slip", length: "midi", sleeve: "none" },
    ],
    [
      "Tailored Wool Blazer",
      undefined,
      { category: "outerwear", silhouette: "tailored", sleeve: "long" },
    ],
    ["Long Trench Coat", undefined, { category: "outerwear", length: "knee" }],
    [
      "Boxy Short Sleeve Tee",
      undefined,
      { category: "top", silhouette: "boxy", sleeve: "short" },
    ],
    [
      "Ribbed Cropped Tank",
      undefined,
      { category: "top", length: "waist", sleeve: "none" },
    ],
  ] as const)("%s", (title, hint, expected) => {
    expect(inferCut(title, hint)).toMatchObject(expected);
  });

  it("does not take a dress shirt or dress pants for a dress", () => {
    expect(inferCut("Slim Fit Dress Shirt").category).toBe("top");
    expect(inferCut("Pleated Dress Pants").category).toBe("bottom");
  });

  it("falls back to the feed category when the title names no garment", () => {
    expect(inferCut("The Ridgeline", "bottoms").category).toBe("bottom");
    expect(inferCut("The Ridgeline", "outerwear").category).toBe("outerwear");
    expect(inferCut("The Ridgeline").category).toBe("top");
  });

  it("only guesses cuts the mannequin can draw", () => {
    const L = landmarks({}, "womens");
    for (const title of [
      "Wide Leg Palazzo Pant",
      "Mini Wrap Dress",
      "Oversized Puffer",
      "Cropped Cardigan",
      "Maxi Skirt",
      "x",
    ]) {
      const g = garmentOutlines(L, inferCut(title));
      for (const shape of [...g.parts, ...g.lines, ...g.folds])
        for (const p of shape)
          expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
    }
  });
});

describe("toCatalogItem", () => {
  it("keeps the merchant's own link, image, price label and color", () => {
    const item = toCatalogItem(product(), "womens");
    expect(item.id).toBe("shopify-AAA111");
    expect(item.productUrl).toBe(product().url);
    expect(item.imageUrl).toBe("https://cdn.shopify.com/trouser.jpg");
    expect(item.brand).toBe("Fernhill");
    expect(item.price).toBe(89.5);
    expect(item.priceLabel).toBe("$89.50");
    expect(item.colors).toEqual(["#6B7A3A"]);
    expect(item.cut).toBe("womens");
    expect(item.source).toBe("shopify");
    expect(item.sizeChartId).toBe(""); // no brand chart, so no size advice
    expect(item.evidence).toBeUndefined();
  });

  it("invents no color when the name has no swatch", () => {
    const item = toCatalogItem(
      product({ color: { name: "Bering Sea", hex: null, source: "variant" } }),
      "both",
    );
    expect(item.colors).toEqual([]);
    expect(item.cut).toBe("unisex");
  });

  it("maps a demo product back to the bundled item with its real cut", () => {
    expect(toCatalogItem(product({ id: "demo:w-03" }), "womens")).toBe(
      findItem("w-03"),
    );
  });

  it("makes live items findable for the item sheet, in memory only", () => {
    const item = toCatalogItem(
      product({ id: "gid://shopify/p/ZZZ999" }),
      "womens",
    );
    expect(findItem(item.id)).toBeUndefined();
    rememberItems([item]);
    expect(findItem(item.id)).toBe(item);
  });
});

describe("toCatalogItem with the backend's AI estimate", () => {
  const estimate = {
    hex: "#71553A",
    confidence: "medium" as const,
    cut: {
      category: "bottom" as const,
      silhouette: "wide-leg" as const,
      length: "ankle" as const,
    },
    clothing: true,
    evidence: "Tobacco; relaxed wide leg",
    source: "ai" as const,
  };

  it("uses the estimated color and cut over the name table and title guess", () => {
    const item = toCatalogItem(
      product({
        title: "The Ridgeline",
        color: { name: "Tobacco", hex: null, source: "variant" },
        estimate,
      }),
      "womens",
    );
    expect(item.colors).toEqual(["#71553A"]);
    expect(item).toMatchObject({
      category: "bottom",
      silhouette: "wide-leg",
      length: "ankle",
    });
    expect(item.evidence).toBe("Tobacco; relaxed wide leg");
  });

  it("ignores a low-confidence color but still takes the cut", () => {
    const item = toCatalogItem(
      product({
        color: { name: "Olive Green", hex: "#6B7A3A", source: "variant" },
        estimate: { ...estimate, confidence: "low" },
      }),
      "womens",
    );
    expect(item.colors).toEqual(["#6B7A3A"]);
    expect(item.silhouette).toBe("wide-leg");
  });
});

describe("recommend with live items", () => {
  it("gives no color score without a known color, instead of 0%", () => {
    const item = toCatalogItem(product({ color: null }), "womens");
    expect(
      recommend([item], SEASONS["soft-autumn"], null)[0].color,
    ).toBeUndefined();
  });
});
