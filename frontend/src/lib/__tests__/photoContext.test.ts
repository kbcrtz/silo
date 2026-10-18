import { FAMILIES, familyOf } from "@/data/families";
import { SEASON_IDS } from "@/data/seasons";
import { adjustForContext, isComplete, traitWords } from "../photoContext";

const photo = { warmth: 0.5, depth: 0.6, clarity: 0.4, confidence: 0.8 };

describe("adjustForContext", () => {
  it("leaves a clean daylight photo alone", () => {
    expect(
      adjustForContext(photo, {
        makeup: "none",
        hair: "natural",
        lighting: "window",
      }),
    ).toEqual(photo);
  });

  it("corrects indoor light for its warm cast and trusts it less", () => {
    const r = adjustForContext(photo, { lighting: "indoor" });
    expect(r.warmth).toBeCloseTo(0.3);
    expect(r.confidence).toBeLessThan(photo.confidence);
  });

  it("discounts depth from dyed hair and undertone under foundation", () => {
    const r = adjustForContext(photo, { hair: "dyed", makeup: "foundation" });
    expect(r.depth).toBeCloseTo(0.3);
    expect(r.warmth).toBeCloseTo(0.3);
  });

  it("needs every question answered", () => {
    expect(
      isComplete({ makeup: "none", hair: "natural", lighting: "sun" }),
    ).toBe(false);
    expect(
      isComplete({
        makeup: "none",
        hair: "natural",
        lighting: "sun",
        style: "none",
      }),
    ).toBe(true);
  });
});

describe("traitWords", () => {
  it("names undertone, clarity and depth", () => {
    expect(traitWords({ warmth: -0.6, clarity: -0.4, depth: -0.5 })).toEqual([
      "Cool",
      "Soft",
      "Light",
    ]);
    expect(traitWords({ warmth: 0, clarity: 0.5, depth: 0.9 })).toEqual([
      "Neutral",
      "Bright",
      "Deep",
    ]);
  });
});

describe("families", () => {
  it("puts every season in a family with a full 5x4 palette", () => {
    for (const id of SEASON_IDS) expect(FAMILIES[familyOf(id)]).toBeDefined();
    for (const f of Object.values(FAMILIES)) expect(f.palette).toHaveLength(20);
    expect(familyOf("soft-autumn")).toBe("warm-autumn");
    expect(familyOf("bright-winter")).toBe("cool-winter");
  });
});
