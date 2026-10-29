import type { CatalogItem, Category } from "@/data/catalog";

/** A whole fit to try on together: at most one piece of each kind. */
export type Fit = Partial<Record<Category, CatalogItem>>;

/** Inner layers first, the order the backend's prompt puts them on. */
const ORDER: Category[] = ["top", "bottom", "dress", "outerwear"];

/** The fit with `item` in it: it replaces the same kind, and a dress replaces the top and bottoms (and they replace it). */
export function addToFit(fit: Fit, item: CatalogItem): Fit {
  const rest: Fit = { ...fit };
  if (item.category === "dress") {
    delete rest.top;
    delete rest.bottom;
  }
  if (item.category === "top" || item.category === "bottom") delete rest.dress;
  return { ...rest, [item.category]: item };
}

export function fitPieces(fit: Fit): CatalogItem[] {
  return ORDER.flatMap((c) => fit[c] ?? []);
}

/** Picking pieces in a list: a picked piece comes out, any other goes in. */
export function toggleInFit(fit: Fit, item: CatalogItem): Fit {
  if (fit[item.category]?.id !== item.id) return addToFit(fit, item);
  const { [item.category]: _, ...rest } = fit;
  return rest;
}

/** The backend draws 2 or 3 pieces in one image. */
export const MIN_PIECES = 2;

/**
 * Whether `items` hold any fit to try on: two kinds that go together, so not
 * three tops, and not only a dress with a top or bottoms.
 */
export function canMakeFit(items: CatalogItem[]): boolean {
  const kinds = new Set(items.map((i) => i.category));
  if (kinds.has("outerwear") && kinds.size >= 2) return true;
  return kinds.has("top") && kinds.has("bottom");
}

export const canTryOn = (fit: Fit) => Object.keys(fit).length >= MIN_PIECES;

/** Which picked item is which: their ids, inner layers first, for the try-on screen. */
export const fitIds = (fit: Fit) => fitPieces(fit).map((i) => i.id);

/** The fit back from ids, skipping any the catalog no longer knows. */
export function fitFromItems(items: (CatalogItem | undefined)[]): Fit {
  return items.reduce<Fit>(
    (fit, item) => (item ? addToFit(fit, item) : fit),
    {},
  );
}
