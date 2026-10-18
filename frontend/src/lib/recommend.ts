import type { CatalogItem } from "@/data/catalog";
import type { Season } from "@/data/seasons";
import type { BodyShape } from "./bodyShape";
import { paletteMatch, type PaletteMatch } from "./paletteMatch";
import { silhouetteMatch, type SilhouetteMatch } from "./silhouette";

export type Recommendation = {
  item: CatalogItem;
  color?: PaletteMatch;
  silhouette?: SilhouetteMatch;
  /** 0-100, what the feed sorts by. */
  score: number;
};

/** Color leads: the wrong color shows from across the room, a cut up close. */
const COLOR_WEIGHT = 0.6;

/**
 * Scores every item by palette and by cut, then sorts best first. Either half
 * can be missing (no color analysis yet, or no chest/waist/hips), in which
 * case the other decides alone; with neither, catalog order is kept.
 */
export function recommend(
  items: CatalogItem[],
  season: Season | null,
  shape: BodyShape | null,
): Recommendation[] {
  return items
    .map((item) => {
      // Live items without a known color get no color score, not 0%.
      const color =
        season && item.colors.length
          ? paletteMatch(item.colors, season)
          : undefined;
      const silhouette = shape
        ? silhouetteMatch(item.silhouette, shape)
        : undefined;
      const score =
        color && silhouette
          ? Math.round(
              COLOR_WEIGHT * color.score +
                (1 - COLOR_WEIGHT) * silhouette.score,
            )
          : (color?.score ?? silhouette?.score ?? 0);
      return { item, color, silhouette, score };
    })
    .sort((a, b) => b.score - a.score);
}
