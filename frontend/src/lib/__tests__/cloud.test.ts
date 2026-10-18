import type { CatalogItem } from "@/data/catalog";
import {
  eventFor,
  measurementRows,
  profileSnapshot,
  savedSnapshot,
  uuidV4,
} from "../cloud";

describe("cloud backup snapshots", () => {
  it("backs up the profile without the selfie or store functions", () => {
    const snap = profileSnapshot({
      onboarded: true,
      shopFor: "womens",
      selfiePhoto: "selfie-123.jpg",
      photoTraits: { warmth: 0.2, depth: 0, clarity: -0.4, confidence: 0.8 },
      quizAnswers: { veins: "green" },
      set: () => {},
      reset: () => {},
    });
    expect(snap).toEqual({
      onboarded: true,
      shopFor: "womens",
      photoTraits: { warmth: 0.2, depth: 0, clarity: -0.4, confidence: 0.8 },
      quizAnswers: { veins: "green" },
    });
  });

  it("backs up saved ids, lists and bookmarks only", () => {
    const snap = savedSnapshot({
      itemIds: ["a"],
      lists: [],
      items: {},
      toggle: () => {},
    });
    expect(snap).toEqual({ itemIds: ["a"], lists: [], items: {} });
  });

  it("sends measurements as type, value and time", () => {
    expect(
      measurementRows([
        {
          id: "waist-2026-10-18T10:00:00.000Z",
          type: "waist",
          value: 72,
          measuredAt: "2026-10-18T10:00:00.000Z",
        },
      ]),
    ).toEqual([
      { type: "waist", value: 72, measuredAt: "2026-10-18T10:00:00.000Z" },
    ]);
  });

  it("makes anonymous ids the backend accepts", () => {
    const id = uuidV4();
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(uuidV4()).not.toBe(id);
  });
});

describe("event payloads", () => {
  const item: CatalogItem = {
    id: "shopify-AAA111",
    name: "Linen Overshirt",
    brand: "Tide",
    cut: "unisex",
    colors: ["#9CAF88"],
    price: 58,
    aspect: 1.25,
    sizeChartId: "",
    source: "shopify",
    category: "outerwear",
    silhouette: "relaxed",
    sleeve: "long",
    length: "hip",
  };

  it("reports what the item looks like and the shopper's season, nothing about the person", () => {
    expect(eventFor("open", item, "soft-autumn")).toEqual({
      kind: "open",
      itemId: "shopify-AAA111",
      season: "soft-autumn",
      garment: "outerwear",
      silhouette: "relaxed",
      color: "#9CAF88",
    });
  });

  it("leaves out what isn't known", () => {
    expect(eventFor("shop", { ...item, colors: [] }, undefined)).toEqual({
      kind: "shop",
      itemId: "shopify-AAA111",
      garment: "outerwear",
      silhouette: "relaxed",
    });
  });
});
