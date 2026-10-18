import type { Silhouette } from "@/data/catalog";
import type { BodyShape } from "./bodyShape";

export type SilhouetteMatch = {
  /** 0-100. */
  score: number;
  label: "Flatters your shape" | "Works for your shape" | "Less flattering";
};

/**
 * How well each cut suits each shape, 0-1, following the usual styling rules
 * the body-shape tips describe: follow a defined waist, balance a heavier half
 * with volume on the other, skim rather than cling through the middle, and add
 * shape where there is little.
 */
const FIT: Record<BodyShape, Record<Silhouette, number>> = {
  hourglass: {
    fitted: 1,
    wrap: 1,
    tailored: 0.9,
    slim: 0.8,
    slip: 0.8,
    "a-line": 0.7,
    straight: 0.6,
    "wide-leg": 0.6,
    cropped: 0.6,
    relaxed: 0.4,
    boxy: 0.2,
  },
  pear: {
    "a-line": 1,
    "wide-leg": 0.9,
    straight: 0.8,
    wrap: 0.8,
    cropped: 0.8,
    tailored: 0.7,
    fitted: 0.6,
    relaxed: 0.5,
    boxy: 0.4,
    slip: 0.3,
    slim: 0.3,
  },
  "inverted-triangle": {
    "wide-leg": 1,
    "a-line": 1,
    wrap: 0.8,
    straight: 0.7,
    relaxed: 0.6,
    slip: 0.6,
    fitted: 0.5,
    tailored: 0.5,
    slim: 0.4,
    cropped: 0.4,
    boxy: 0.3,
  },
  apple: {
    wrap: 1,
    straight: 0.9,
    "a-line": 0.8,
    relaxed: 0.8,
    tailored: 0.8,
    "wide-leg": 0.6,
    boxy: 0.5,
    slim: 0.5,
    slip: 0.4,
    fitted: 0.3,
    cropped: 0.2,
  },
  rectangle: {
    cropped: 1,
    wrap: 0.9,
    "a-line": 0.8,
    "wide-leg": 0.8,
    tailored: 0.8,
    boxy: 0.7,
    slip: 0.7,
    straight: 0.7,
    slim: 0.7,
    relaxed: 0.6,
    fitted: 0.6,
  },
};

export function silhouetteMatch(
  silhouette: Silhouette,
  shape: BodyShape,
): SilhouetteMatch {
  const fit = FIT[shape][silhouette];
  const label =
    fit >= 0.8
      ? "Flatters your shape"
      : fit >= 0.6
        ? "Works for your shape"
        : "Less flattering";
  return { score: Math.round(fit * 100), label };
}
