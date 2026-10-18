import type { ColorTraits } from "@/data/seasons";
import type { PhotoTraits } from "./colorAnalysis";

/**
 * What the user tells us about their selfie, asked right after taking it.
 * Makeup, dyed hair and lighting each skew what a photo shows, so the answers
 * correct the photo reading; style is a preference for recommendations.
 */
export type PhotoContext = {
  makeup?: "none" | "light" | "foundation";
  hair?: "natural" | "dyed" | "gray";
  lighting?: "window" | "sun" | "indoor";
  style?: "minimal" | "colorful" | "dark" | "none";
};

export type PhotoQuestion = {
  [K in keyof PhotoContext]-?: {
    id: K;
    prompt: string;
    options: { id: NonNullable<PhotoContext[K]>; label: string }[];
  };
}[keyof PhotoContext];

export const PHOTO_QUESTIONS: PhotoQuestion[] = [
  {
    id: "makeup",
    prompt: "Are you wearing makeup in this photo?",
    options: [
      { id: "none", label: "No makeup" },
      { id: "light", label: "Light makeup" },
      { id: "foundation", label: "Foundation or complexion products" },
    ],
  },
  {
    id: "hair",
    prompt: "Is your hair its natural color?",
    options: [
      { id: "natural", label: "Yes, it’s natural" },
      { id: "dyed", label: "No, it’s dyed" },
      { id: "gray", label: "It’s naturally gray or white" },
    ],
  },
  {
    id: "lighting",
    prompt: "How was this photo taken?",
    options: [
      { id: "window", label: "Natural daylight near a window" },
      { id: "sun", label: "Outside in direct sunlight" },
      { id: "indoor", label: "Indoor or artificial lighting" },
    ],
  },
  {
    id: "style",
    prompt: "Do you have a preferred style?",
    options: [
      { id: "minimal", label: "Minimal and neutral" },
      { id: "colorful", label: "Colorful and expressive" },
      { id: "dark", label: "Dark and monochromatic" },
      { id: "none", label: "No preference" },
    ],
  },
];

export function isComplete(context: PhotoContext): boolean {
  return PHOTO_QUESTIONS.every((q) => context[q.id] !== undefined);
}

const clamp = (v: number) => Math.max(-1, Math.min(1, v));

/**
 * Corrects a photo reading for how the photo was taken:
 * - Foundation evens out skin and masks undertone, so warmth reads weaker.
 * - Dyed hair says nothing about natural depth, which hair mostly drives.
 * - Indoor bulbs cast warm, so the photo reads warmer than the person is;
 *   direct sun flattens and bleaches, exaggerating clarity.
 * Each problem also lowers confidence. Style doesn't touch the reading.
 */
export function adjustForContext(
  photo: PhotoTraits,
  context: PhotoContext,
): PhotoTraits {
  let { warmth, depth, clarity, confidence } = photo;
  if (context.makeup === "light") {
    warmth *= 0.85;
    confidence *= 0.9;
  } else if (context.makeup === "foundation") {
    warmth *= 0.6;
    confidence *= 0.75;
  }
  if (context.hair === "dyed") {
    depth *= 0.5;
    confidence *= 0.85;
  }
  if (context.lighting === "indoor") {
    warmth -= 0.2;
    confidence *= 0.7;
  } else if (context.lighting === "sun") {
    clarity -= 0.15;
    confidence *= 0.85;
  }
  return {
    warmth: clamp(warmth),
    depth: clamp(depth),
    clarity: clamp(clarity),
    confidence: Math.max(0, Math.min(1, confidence)),
  };
}

/** "COOL · SOFT · LIGHT": undertone, clarity and depth in a word each. */
export function traitWords(traits: ColorTraits): string[] {
  const pick = (v: number, low: string, mid: string, high: string) =>
    v > 0.15 ? high : v < -0.15 ? low : mid;
  return [
    pick(traits.warmth, "Cool", "Neutral", "Warm"),
    pick(traits.clarity, "Soft", "Balanced", "Bright"),
    pick(traits.depth, "Light", "Medium", "Deep"),
  ];
}
