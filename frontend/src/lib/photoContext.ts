import type { ColorTraits } from "@/data/seasons";
import {
  scoreQuiz,
  type PhotoTraits,
  type QuizQuestion,
} from "./colorAnalysis";

/**
 * The questions asked right after the selfie. Most describe the person
 * (veins, sun, hair, eyes, lips) and are scored like the quiz; the last is a
 * checklist about the selfie itself, which corrects the photo reading.
 */
export type SelfieFlag = "makeup" | "filter" | "dim" | "none";

export type PhotoContext = {
  /** Question id to option id, for the questions about the person. */
  answers?: Record<string, string>;
  selfie?: SelfieFlag[];
};

export const TRAIT_QUESTIONS: QuizQuestion[] = [
  {
    id: "veins",
    prompt:
      "What color are the veins on your inner wrist? (check in daylight.)",
    options: [
      { id: "blue", label: "blue/purple", weights: { warmth: -1 } },
      { id: "green", label: "green/olive", weights: { warmth: 1 } },
      { id: "mix", label: "mix/hard to tell", weights: { warmth: 0 } },
    ],
  },
  {
    id: "sun",
    prompt: "How does your skin react to the sun?",
    options: [
      {
        id: "burn",
        label: "burns, rarely tans",
        weights: { warmth: -0.5, depth: -0.5 },
      },
      { id: "both", label: "burns, tans", weights: { warmth: 0, depth: 0 } },
      {
        id: "tan",
        label: "tans easily, rarely burns",
        weights: { warmth: 0.5, depth: 0.5 },
      },
    ],
  },
  {
    id: "hair",
    prompt: "What is your natural hair color?",
    options: [
      { id: "blonde", label: "blonde", weights: { depth: -0.8 } },
      { id: "brown", label: "brown", weights: { depth: 0.3 } },
      { id: "black", label: "black", weights: { depth: 1, clarity: 0.3 } },
      { id: "red", label: "red", weights: { warmth: 1, depth: 0.2 } },
      {
        id: "gray",
        label: "gray/white",
        weights: { warmth: -0.3, depth: -0.3, clarity: -0.5 },
      },
    ],
  },
  {
    id: "eyes",
    prompt: "What color are your eyes?",
    options: [
      { id: "brown", label: "brown", weights: { depth: 0.6, warmth: 0.2 } },
      { id: "blue", label: "blue", weights: { clarity: 0.6, warmth: -0.4 } },
      { id: "green", label: "green", weights: { clarity: 0.5, warmth: 0.2 } },
      { id: "hazel", label: "hazel", weights: { clarity: -0.4, warmth: 0.4 } },
      {
        id: "grey",
        label: "grey",
        weights: { clarity: -0.6, warmth: -0.3, depth: -0.3 },
      },
    ],
  },
  {
    id: "lips",
    prompt: "What color are your lips with no lipstick?",
    options: [
      {
        id: "pale",
        label: "pale/pink",
        weights: { warmth: -0.5, depth: -0.5 },
      },
      {
        id: "berry",
        label: "berry pink",
        weights: { warmth: -0.8, clarity: 0.3 },
      },
      { id: "coral", label: "coral", weights: { warmth: 0.8 } },
      { id: "red", label: "red", weights: { clarity: 0.6 } },
      {
        id: "brownish",
        label: "brownish",
        weights: { warmth: 0.5, depth: 0.5 },
      },
      { id: "unsure", label: "not sure", weights: {} },
    ],
  },
];

export const SELFIE_QUESTION = {
  prompt: "About your selfie, check any that apply:",
  options: [
    { id: "makeup", label: "wearing makeup/lipstick" },
    { id: "filter", label: "beauty filter" },
    { id: "dim", label: "dim lighting" },
    { id: "none", label: "none of these" },
  ] satisfies { id: SelfieFlag; label: string }[],
};

/** Ticks a selfie flag; "none of these" and the others exclude each other. */
export function toggleSelfieFlag(
  flags: SelfieFlag[],
  flag: SelfieFlag,
): SelfieFlag[] {
  if (flags.includes(flag)) return flags.filter((f) => f !== flag);
  if (flag === "none") return ["none"];
  return [...flags.filter((f) => f !== "none"), flag];
}

export function isComplete(context: PhotoContext): boolean {
  return (
    TRAIT_QUESTIONS.every((q) => context.answers?.[q.id] !== undefined) &&
    !!context.selfie?.length
  );
}

/** What the user says about their own coloring, on the season axes. */
export function selfReportedTraits(context: PhotoContext): ColorTraits {
  return scoreQuiz(context.answers ?? {}, TRAIT_QUESTIONS);
}

const clamp = (v: number) => Math.max(-1, Math.min(1, v));

/**
 * Corrects a photo reading for how the selfie was taken:
 * - Makeup evens out skin and masks undertone, so warmth reads weaker.
 * - A beauty filter smooths and brightens, so clarity and warmth are unreliable.
 * - Dim light muddies the photo and makes it read deeper than the person is.
 * Each problem also lowers confidence, shifting weight to the answers.
 */
export function adjustForContext(
  photo: PhotoTraits,
  selfie: SelfieFlag[] = [],
): PhotoTraits {
  let { warmth, depth, clarity, confidence } = photo;
  if (selfie.includes("makeup")) {
    warmth *= 0.6;
    confidence *= 0.75;
  }
  if (selfie.includes("filter")) {
    warmth *= 0.8;
    clarity *= 0.7;
    confidence *= 0.6;
  }
  if (selfie.includes("dim")) {
    depth -= 0.2;
    confidence *= 0.7;
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
