import { SIZE_CHARTS } from "@/data/sizeCharts";
import { bodyShape } from "../bodyShape";
import { recommendSize } from "../fit";

const tops = SIZE_CHARTS["womens-tops"];

describe("recommendSize", () => {
  it("picks the size whose ranges contain every measurement", () => {
    const rec = recommendSize({ chest: 90, waist: 72, armLength: 58 }, tops);
    expect(rec).toEqual({
      kind: "size",
      size: "M",
      confidence: "high",
      notes: [],
    });
  });

  it("asks for the measurements the chart needs", () => {
    expect(recommendSize({ chest: 90 }, tops)).toEqual({
      kind: "missing",
      missing: ["waist", "armLength"],
    });
  });

  it("notes where a between-sizes fit will pull", () => {
    const rec = recommendSize({ chest: 95, waist: 72, armLength: 58 }, tops);
    expect(rec.kind === "size" && rec.notes).toEqual([
      "May be snug at the chest / bust",
    ]);
  });

  it("lets fit preference break a near tie, not override a clear fit", () => {
    // Chest says L, waist says M: 2cm out either way.
    const between = { chest: 95, waist: 73, armLength: 58 };
    expect(recommendSize(between, tops, "slim")).toMatchObject({ size: "M" });
    expect(recommendSize(between, tops, "relaxed")).toMatchObject({
      size: "L",
    });

    const clearlyM = { chest: 90, waist: 72, armLength: 58 };
    expect(recommendSize(clearlyM, tops, "relaxed")).toMatchObject({
      size: "M",
    });
  });
});

describe("bodyShape", () => {
  it.each([
    [{ chest: 92, waist: 66, hips: 94 }, "hourglass"],
    [{ chest: 86, waist: 70, hips: 102 }, "pear"],
    [{ chest: 104, waist: 82, hips: 94 }, "inverted-triangle"],
    [{ chest: 96, waist: 92, hips: 98 }, "apple"],
    [{ chest: 90, waist: 76, hips: 92 }, "rectangle"],
  ])("%j is %s", (m, shape) => {
    expect(bodyShape(m)?.shape).toBe(shape);
  });

  it("needs chest, waist and hips", () => {
    expect(bodyShape({ chest: 90, waist: 70 })).toBeNull();
  });
});
