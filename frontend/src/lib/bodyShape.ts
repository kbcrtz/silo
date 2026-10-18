import { upperGirth, type Measurements } from "./measurements";

export type BodyShape =
  "hourglass" | "pear" | "inverted-triangle" | "apple" | "rectangle";

export type BodyShapeResult = {
  shape: BodyShape;
  name: string;
  description: string;
  tips: string[];
};

const SHAPES: Record<BodyShape, Omit<BodyShapeResult, "shape">> = {
  hourglass: {
    name: "Hourglass",
    description: "Chest and hips are balanced with a clearly defined waist.",
    tips: [
      "Fitted and wrap styles that follow your waist",
      "Belts at the natural waist",
    ],
  },
  pear: {
    name: "Pear",
    description: "Hips are wider than your chest.",
    tips: [
      "Draw the eye up with detail on top",
      "A-line and straight-leg bottoms",
    ],
  },
  "inverted-triangle": {
    name: "Inverted triangle",
    description: "Shoulders and chest are wider than your hips.",
    tips: ["Simple, clean tops", "Volume or pattern on the bottom half"],
  },
  apple: {
    name: "Apple",
    description: "Weight sits through the middle, with less waist definition.",
    tips: [
      "Structured layers that skim the midsection",
      "V-necks to lengthen the torso",
    ],
  },
  rectangle: {
    name: "Rectangle",
    description: "Chest, waist and hips are similar widths.",
    tips: [
      "Layering and texture to add shape",
      "Cropped jackets and belted looks",
    ],
  },
};

/**
 * Classifies by the usual chest/waist/hip ratio rules. The order matters:
 * a large waist overrides everything, then a defined waist with balanced
 * chest and hips, then whichever of chest or hips leads by more than 5%.
 * Returns null until all three measurements exist.
 */
export function bodyShape(m: Measurements): BodyShapeResult | null {
  const { waist, hips } = m;
  const chest = upperGirth(m);
  if (!chest || !waist || !hips) return null;

  const narrowest = Math.min(chest, hips);
  const balanced = Math.abs(chest - hips) / Math.max(chest, hips) <= 0.05;

  let shape: BodyShape;
  if (waist / narrowest >= 0.9) shape = "apple";
  else if (balanced && waist / narrowest <= 0.75) shape = "hourglass";
  else if (hips / chest > 1.05) shape = "pear";
  else if (chest / hips > 1.05) shape = "inverted-triangle";
  else shape = "rectangle";

  return { shape, ...SHAPES[shape] };
}
