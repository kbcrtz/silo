import { CATALOG, type Category } from "@/data/catalog";
import {
  addToFit,
  canMakeFit,
  canTryOn,
  fitFromItems,
  fitIds,
  fitPieces,
  outfitName,
  toggleInFit,
} from "../outfit";

const of = (category: Category) =>
  CATALOG.find((i) => i.category === category)!;

describe("addToFit", () => {
  it("keeps one piece of each kind, the newest winning", () => {
    const top = of("top");
    const other = { ...top, id: "other-top" };
    expect(addToFit({ top }, other)).toEqual({ top: other });
    expect(addToFit({ top }, of("bottom"))).toEqual({
      top,
      bottom: of("bottom"),
    });
  });

  it("swaps a dress for the top and bottoms, and back", () => {
    const fit = addToFit(
      { top: of("top"), bottom: of("bottom"), outerwear: of("outerwear") },
      of("dress"),
    );
    expect(fit).toEqual({ dress: of("dress"), outerwear: of("outerwear") });
    expect(addToFit(fit, of("bottom"))).toEqual({
      bottom: of("bottom"),
      outerwear: of("outerwear"),
    });
  });
});

describe("fitPieces", () => {
  it("lists inner layers first", () => {
    const fit = {
      outerwear: of("outerwear"),
      bottom: of("bottom"),
      top: of("top"),
    };
    expect(fitPieces(fit).map((i) => i.category)).toEqual([
      "top",
      "bottom",
      "outerwear",
    ]);
  });
});

describe("toggleInFit", () => {
  it("picks a piece, and a second tap puts it back", () => {
    const top = of("top");
    const fit = toggleInFit({}, top);
    expect(fit).toEqual({ top });
    expect(toggleInFit(fit, top)).toEqual({});
  });

  it("swaps another piece of the same kind in", () => {
    const top = of("top");
    const other = { ...top, id: "other-top" };
    expect(toggleInFit({ top }, other)).toEqual({ top: other });
  });
});

describe("trying a fit on", () => {
  it("needs at least two pieces", () => {
    expect(canTryOn({ top: of("top") })).toBe(false);
    expect(canTryOn({ top: of("top"), bottom: of("bottom") })).toBe(true);
  });

  it("round-trips through ids, dropping unknown items", () => {
    const fit = { bottom: of("bottom"), top: of("top") };
    expect(fitIds(fit)).toEqual([of("top").id, of("bottom").id]);
    expect(fitFromItems([of("top"), undefined, of("bottom")])).toEqual(fit);
  });
});

describe("canMakeFit", () => {
  it("needs two kinds that go together", () => {
    const top = of("top");
    expect(canMakeFit([top])).toBe(false);
    expect(canMakeFit([top, { ...top, id: "other-top" }])).toBe(false);
    expect(canMakeFit([of("dress"), top, of("bottom")])).toBe(true);
    expect(canMakeFit([of("dress"), top])).toBe(false);
    expect(canMakeFit([of("dress"), of("outerwear")])).toBe(true);
    expect(canMakeFit([top, of("outerwear")])).toBe(true);
  });
});

describe("outfitName", () => {
  it("names a fit after its pieces, inner layers first", () => {
    const named = (name: string, category: Category) => ({
      ...of(category),
      name,
    });
    expect(
      outfitName([
        named("Boxy Short Sleeve Tee", "top"),
        named("Everyday Relaxed Trouser (Olive)", "bottom"),
        named("Tailored Wool Blazer", "outerwear"),
      ]),
    ).toBe("Tee + Trouser + Blazer");
  });
});

it("capitalizes a fit name made from lowercase item names", () => {
  expect(
    outfitName([
      { ...of("bottom"), name: "Charcoal straight jean" },
      { ...of("outerwear"), name: "Olive field jacket" },
    ]),
  ).toBe("Jean + Jacket");
});
