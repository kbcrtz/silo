import {
  bodyFit,
  bodyTraits,
  describeBody,
  sinkPoorFits,
  type BodyTraits,
} from "../bodyFit";

const top = (
  silhouette: "cropped" | "fitted" | "straight" | "boxy" | "wrap",
  length: "waist" | "hip" | "thigh" = "hip",
) => ({ category: "top", silhouette, length }) as const;

describe("bodyTraits", () => {
  it("reads height against the department", () => {
    expect(bodyTraits({ height: 158 }, "womens").height).toBe("petite");
    expect(bodyTraits({ height: 165 }, "mens").height).toBe("petite");
    expect(bodyTraits({ height: 165 }, "womens").height).toBeUndefined();
    expect(bodyTraits({ height: 190 }, "mens").height).toBe("tall");
  });

  it("reads build from waist to height, else from weight", () => {
    expect(bodyTraits({ height: 170, waist: 100 }, "mens").build).toBe(
      "fuller",
    );
    expect(bodyTraits({ height: 170, waist: 68 }, "mens").build).toBe(
      "slender",
    );
    expect(bodyTraits({ height: 152, weight: 91 }, "mens").build).toBe(
      "fuller",
    );
    expect(
      bodyTraits({ height: 175, weight: 70 }, "mens").build,
    ).toBeUndefined();
  });

  it("reads leg length from inseam, and nothing without a height", () => {
    expect(bodyTraits({ height: 170, inseam: 72 }, "womens").legs).toBe(
      "short",
    );
    expect(bodyTraits({ height: 170, inseam: 84 }, "womens").legs).toBe("long");
    expect(bodyTraits({ waist: 100, weight: 120 }, "mens")).toEqual({});
  });
});

describe("bodyFit", () => {
  const petite: BodyTraits = { height: "petite" };
  const fuller: BodyTraits = { build: "fuller" };

  it("shows leg on a petite frame and keeps oversized off it", () => {
    expect(bodyFit(top("cropped", "waist"), petite).score).toBeGreaterThan(
      bodyFit(top("straight", "thigh"), petite).score,
    );
    expect(bodyFit(top("boxy"), petite).reason).toBe(
      "Oversized cuts can swamp a petite frame",
    );
    expect(bodyFit(top("cropped", "waist"), petite)).toMatchObject({
      label: "Flatters you",
      reason: "A cropped length shows more leg",
    });
  });

  it("keeps a fuller build out of cropped and clingy tops", () => {
    const crop = bodyFit(top("cropped", "waist"), fuller);
    expect(crop.label).toBe("Less flattering");
    expect(crop.reason).toBe("A cropped hem lands on the midsection");
    expect(bodyFit(top("fitted"), fuller).score).toBeLessThan(
      bodyFit(top("straight"), fuller).score,
    );
    expect(bodyFit(top("wrap"), fuller).label).toBe("Flatters you");
  });

  it("lets a fuller build win over petite on a cropped top", () => {
    const both = bodyFit(top("cropped", "waist"), { ...petite, ...fuller });
    expect(both.label).toBe("Less flattering");
  });

  it("starts from the shape's cut table", () => {
    const pear = bodyFit(
      { category: "bottom", silhouette: "a-line", length: "knee" },
      { shape: "pear" },
    );
    expect(pear.score).toBe(100);
  });
});

describe("sinkPoorFits", () => {
  it("sinks poor fits a few places without sorting the rest", () => {
    const items = Array.from({ length: 12 }, (_, i) => i);
    const fits: Record<number, number> = { 0: 10 };
    const out = sinkPoorFits(items, (i) => fits[i] ?? 90);
    expect(out[0]).toBe(1);
    expect(out.indexOf(0)).toBeGreaterThan(5);
    expect(out.filter((i) => i !== 0)).toEqual(items.slice(1));
  });
});

describe("describeBody", () => {
  it("says what the feed is cut for", () => {
    expect(
      describeBody({ height: "petite", build: "fuller", shape: "apple" }),
    ).toBe("petite, fuller apple shape");
    expect(describeBody({ height: "tall" })).toBe("tall frame");
    expect(describeBody({ shape: "inverted-triangle" })).toBe(
      "inverted triangle shape",
    );
    expect(describeBody({})).toBeNull();
  });
});
