import type { CatalogItem } from "@/data/catalog";
import type { Season } from "@/data/seasons";
import { bodyFit, hasTraits, type BodyFit, type BodyTraits } from "./bodyFit";
import { paletteMatch, type PaletteMatch } from "./paletteMatch";

export type Recommendation = {
  item: CatalogItem;
  color?: PaletteMatch;
  fit?: BodyFit;
  /** 0-100, what the feed sorts by. */
  score: number;
};

/** Color leads: the wrong color shows from across the room, a cut up close. */
const COLOR_WEIGHT = 0.6;

/**
 * Scores every item by palette and by how its cut and length suit the body,
 * then sorts best first. Either half can be missing (no color analysis yet,
 * or no measurements), in which case the other decides alone; with neither,
 * catalog order is kept.
 */
export function recommend(
  items: CatalogItem[],
  season: Season | null,
  body: BodyTraits | null,
): Recommendation[] {
  return items
    .map((item) => {
      // Live items without a known color get no color score, not 0%.
      const color =
        season && item.colors.length
          ? paletteMatch(item.colors, season)
          : undefined;
      const fit = body && hasTraits(body) ? bodyFit(item, body) : undefined;
      const score =
        color && fit
          ? Math.round(
              COLOR_WEIGHT * color.score + (1 - COLOR_WEIGHT) * fit.score,
            )
          : (color?.score ?? fit?.score ?? 0);
      return { item, color, fit, score };
    })
    .sort((a, b) => b.score - a.score);
}
