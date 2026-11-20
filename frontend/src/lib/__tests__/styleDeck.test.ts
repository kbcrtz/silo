import { buildDeck, readSwipes, type DeckPhotos } from "../styleDeck";

const photos: DeckPhotos<string> = {
  womens: {
    minimal: ["w-min-1", "w-min-2"],
    preppy: ["w-pre-1", "w-pre-2"],
    boho: ["w-boho-1"],
  },
  mens: {
    minimal: ["m-min-1", "m-min-2"],
    workwear: ["m-work-1", "m-work-2"],
  },
};

/** A seeded stream so shuffles repeat. */
function seeded(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

describe("buildDeck", () => {
  it("shows a department's two photos per look, every look before any repeats", () => {
    const deck = buildDeck(photos, "womens", seeded(3));
    expect(deck.map((c) => c.image).sort()).toEqual(
      ["w-boho-1", "w-min-1", "w-min-2", "w-pre-1", "w-pre-2"].sort(),
    );
    const firstRound = deck
      .slice(0, 3)
      .map((c) => c.look)
      .sort();
    expect(firstRound).toEqual(["boho", "minimal", "preppy"]);
    expect(deck.every((c) => c.dept === "womens")).toBe(true);
  });

  it("shows each department's first photo for both", () => {
    const deck = buildDeck(photos, "both", seeded(7));
    expect(deck.map((c) => c.image).sort()).toEqual(
      ["m-min-1", "m-work-1", "w-boho-1", "w-min-1", "w-pre-1"].sort(),
    );
  });

  it("never shows a look twice in a row", () => {
    for (let seed = 1; seed < 200; seed++) {
      const deck = buildDeck(photos, "womens", seeded(seed));
      deck.slice(1).forEach((c, i) => expect(c.look).not.toBe(deck[i].look));
    }
  });

  it("skips looks with no photos", () => {
    expect(buildDeck({ womens: {}, mens: {} }, "mens")).toEqual([]);
  });
});

describe("readSwipes", () => {
  it("likes looks with more rights than lefts, strongest first", () => {
    expect(
      readSwipes([
        { look: "boho", liked: true },
        { look: "minimal", liked: true },
        { look: "preppy", liked: true },
        { look: "minimal", liked: true },
        { look: "preppy", liked: false },
        { look: "boho", liked: true },
      ]).liked,
    ).toEqual(["boho", "minimal"]);
  });

  it("keeps at most three, breaking ties by which was liked first", () => {
    const looks = ["edgy", "boho", "classic", "sporty"] as const;
    expect(
      readSwipes(looks.map((look) => ({ look, liked: true }))).liked,
    ).toEqual(["edgy", "boho", "classic"]);
  });

  it("turns a look down only when two photos were both passed", () => {
    const { rejected } = readSwipes([
      { look: "boho", liked: false },
      { look: "edgy", liked: false },
      { look: "edgy", liked: false },
      { look: "sporty", liked: false },
      { look: "sporty", liked: true },
    ]);
    expect(rejected).toEqual(["edgy"]);
  });
});
