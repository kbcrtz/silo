import type { Season } from "@/data/seasons";
import { deltaE } from "./color";

export type PaletteMatch = {
  /** 0-100. */
  score: number;
  label: "Great match" | "Good match" | "Okay" | "Not your colors";
};

/** Beyond this Lab distance a color no longer reads as "in the palette". */
const MAX_DISTANCE = 50;
/** Closer than this to an avoid color counts as wearing it. */
const AVOID_DISTANCE = 15;

/**
 * Scores an item by how close each of its colors is to the season's best and
 * neutral colors. A color that sits nearer an avoid color than any good one
 * halves the score: one clashing color is what people notice.
 */
export function paletteMatch(
  itemColors: string[],
  season: Season,
): PaletteMatch {
  if (itemColors.length === 0) return { score: 0, label: "Okay" };
  const good = [...season.best, ...season.neutrals];

  let total = 0;
  let clashes = false;
  for (const color of itemColors) {
    const nearestGood = Math.min(...good.map((g) => deltaE(color, g)));
    const nearestAvoid = Math.min(...season.avoid.map((a) => deltaE(color, a)));
    if (nearestAvoid < AVOID_DISTANCE && nearestAvoid < nearestGood)
      clashes = true;
    total += Math.max(0, 1 - nearestGood / MAX_DISTANCE);
  }

  let score = Math.round((total / itemColors.length) * 100);
  if (clashes) score = Math.round(score / 2);

  const label =
    score >= 75
      ? "Great match"
      : score >= 55
        ? "Good match"
        : score >= 35
          ? "Okay"
          : "Not your colors";
  return { score, label };
}
