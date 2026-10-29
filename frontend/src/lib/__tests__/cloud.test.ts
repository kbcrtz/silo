import type { CatalogItem } from "@/data/catalog";
import {
  entriesFromBackup,
  eventFor,
  isEmptyInstall,
  measurementRows,
  photoToUpload,
  profileSnapshot,
  savedSnapshot,
} from "../cloud";

describe("cloud backup snapshots", () => {
  it("backs up the profile without the photo's file names or store functions", () => {
    const snap = profileSnapshot({
      onboarded: true,
      shopFor: "womens",
      selfiePhoto: "selfie-123.jpg",
      photoSynced: "selfie-100.jpg",
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

  it("uploads the photo only when it differs from the one the server has", () => {
    expect(
      photoToUpload({
        selfiePhoto: "selfie-2.jpg",
        photoSynced: "selfie-1.jpg",
      }),
    ).toBe("selfie-2.jpg");
    expect(
      photoToUpload({
        selfiePhoto: "selfie-2.jpg",
        photoSynced: "selfie-2.jpg",
      }),
    ).toBeNull();
    expect(photoToUpload({})).toBeNull();
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

describe("restore on an empty install", () => {
  const empty = { onboarded: false, colorProfile: undefined };
  it("restores only when nothing at all is on the phone", () => {
    expect(isEmptyInstall(empty, 0, 0)).toBe(true);
    expect(isEmptyInstall({ ...empty, onboarded: true }, 0, 0)).toBe(false);
    // "Redo onboarding" keeps the season and history: never overwrite that.
    expect(
      isEmptyInstall(
        { onboarded: false, colorProfile: { seasonId: "soft-autumn" } },
        0,
        0,
      ),
    ).toBe(false);
    expect(isEmptyInstall(empty, 3, 0)).toBe(false);
    expect(isEmptyInstall(empty, 0, 1)).toBe(false);
  });

  it("turns backed-up measurements back into the phone's entries", () => {
    expect(
      entriesFromBackup([
        { type: "waist", value: 72, measuredAt: "2026-10-18T10:00:00.000Z" },
      ]),
    ).toEqual([
      {
        id: "waist-2026-10-18T10:00:00.000Z",
        type: "waist",
        value: 72,
        measuredAt: "2026-10-18T10:00:00.000Z",
      },
    ]);
  });
});
