import { CATALOG, type Category } from "@/data/catalog";
import { addToFit, fitPieces } from "../outfit";

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
