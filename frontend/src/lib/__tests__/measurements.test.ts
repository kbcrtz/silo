import { isPlausible, latestMeasurements, PLAUSIBLE } from "../measurements";

describe("plausible measurements", () => {
  it("rejects numbers no adult body has, like a height typed in feet", () => {
    expect(isPlausible("height", 6 * 2.54)).toBe(false); // "6" in an inches field
    expect(isPlausible("height", 178)).toBe(true);
    expect(isPlausible("chest", 254)).toBe(false); // "100" inches
    expect(isPlausible("chest", 100)).toBe(true);
    expect(isPlausible("inseam", 25.4)).toBe(false);
    expect(isPlausible("weight", 80)).toBe(true);
  });

  it("covers every measurement type", () => {
    for (const [min, max] of Object.values(PLAUSIBLE))
      expect(min).toBeLessThan(max);
  });

  it("ignores implausible saved entries, so old typos stop shaping the figure", () => {
    const latest = latestMeasurements([
      {
        id: "a",
        type: "height",
        value: 15.2,
        measuredAt: "2026-10-18T10:00:00.000Z",
      },
      {
        id: "b",
        type: "chest",
        value: 100,
        measuredAt: "2026-10-18T10:00:00.000Z",
      },
    ]);
    expect(latest).toEqual({ chest: 100 });
  });
});
