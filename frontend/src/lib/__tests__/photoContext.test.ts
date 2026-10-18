import { FAMILIES, familyOf } from "@/data/families";
import { SEASON_IDS } from "@/data/seasons";
import {
  adjustForContext,
  isComplete,
  selfReportedTraits,
  toggleSelfieFlag,
  traitWords,
} from "../photoContext";

const photo = { warmth: 0.5, depth: 0.6, clarity: 0.4, confidence: 0.8 };

describe("adjustForContext", () => {
  it("leaves a clean selfie alone", () => {
    expect(adjustForContext(photo, ["none"])).toEqual(photo);
  });

  it("reads a dim photo lighter and trusts it less", () => {
    const r = adjustForContext(photo, ["dim"]);
    expect(r.depth).toBeCloseTo(0.4);
    expect(r.confidence).toBeLessThan(photo.confidence);
  });

  it("discounts undertone under makeup and a filter", () => {
    const r = adjustForContext(photo, ["makeup", "filter"]);
    expect(r.warmth).toBeCloseTo(0.24);
    expect(r.clarity).toBeCloseTo(0.28);
  });
});

describe("selfie checklist", () => {
  it("keeps none of these exclusive", () => {
    expect(toggleSelfieFlag(["makeup"], "none")).toEqual(["none"]);
    expect(toggleSelfieFlag(["none"], "dim")).toEqual(["dim"]);
    expect(toggleSelfieFlag(["dim", "filter"], "dim")).toEqual(["filter"]);
  });
});

describe("self-reported traits", () => {
  const answers = {
    veins: "green",
    sun: "tan",
    hair: "red",
    eyes: "hazel",
    lips: "coral",
  };

  it("reads warm answers as warm", () => {
    expect(selfReportedTraits({ answers }).warmth).toBeGreaterThan(0.5);
  });

  it("ignores not sure instead of pulling toward neutral", () => {
    const sure = selfReportedTraits({ answers: { veins: "blue" } });
    const unsure = selfReportedTraits({
      answers: { veins: "blue", lips: "unsure" },
    });
    expect(unsure).toEqual(sure);
  });

  it("needs every question and the checklist", () => {
    expect(isComplete({ answers })).toBe(false);
    expect(isComplete({ answers, selfie: ["none"] })).toBe(true);
    expect(isComplete({ answers: { veins: "blue" }, selfie: ["none"] })).toBe(
      false,
    );
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
