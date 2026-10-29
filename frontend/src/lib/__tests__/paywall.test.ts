import {
  formatPrice,
  pickLooks,
  paletteRuns,
  perMonth,
  PLANS,
  savingsPercent,
  yearCost,
} from "../paywall";

describe("paywall prices", () => {
  it("formats cents as dollars", () => {
    expect(formatPrice(3999)).toBe("$39.99");
    expect(formatPrice(4000)).toBe("$40");
    expect(formatPrice(333)).toBe("$3.33");
  });

  it("spreads the annual price over months", () => {
    expect(perMonth(PLANS.annual)).toBe(416);
    expect(perMonth(PLANS.monthly)).toBe(599);
  });

  it("compares a year of each plan", () => {
    expect(yearCost(PLANS.weekly)).toBe(10348);
    expect(savingsPercent(PLANS.annual, PLANS.monthly)).toBe(30);
    expect(savingsPercent(PLANS.annual, PLANS.weekly)).toBe(51);
    expect(savingsPercent(PLANS.monthly, PLANS.monthly)).toBe(0);
  });
});

describe("paletteRuns", () => {
  const palette = Array.from({ length: 20 }, (_, i) => `#${i}`);

  it("gives each card its own run of the palette", () => {
    const runs = paletteRuns(palette, 4);
    expect(runs).toHaveLength(4);
    expect(runs[0]).toEqual(["#0", "#1", "#2", "#3", "#4"]);
    expect(runs[3]).toEqual(["#15", "#16", "#17", "#18", "#19"]);
  });

  it("drops empty runs from a short palette", () => {
    expect(paletteRuns(["#a", "#b"], 4)).toEqual([["#a"], ["#b"]]);
  });
});

describe("pickLooks", () => {
  const sets = { womens: ["w1", "w2", "w3"], mens: ["m1", "m2", "m3"] };

  it("uses the shopper's own set", () => {
    expect(pickLooks(sets, "mens", 3)).toEqual(["m1", "m2", "m3"]);
  });

  it("takes the two sets in turn for both", () => {
    expect(pickLooks(sets, "both", 5)).toEqual(["w1", "m1", "w2", "m2", "w3"]);
  });

  it("is empty when a set is short, so the fan shows the palette", () => {
    expect(pickLooks({ womens: ["w1"], mens: [] }, "womens", 5)).toEqual([]);
  });
});
