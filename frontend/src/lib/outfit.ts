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
