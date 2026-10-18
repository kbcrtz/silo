import {
  SEASON_IDS,
  SEASONS,
  type ColorTraits,
  type SeasonId,
} from "@/data/seasons";

type Axis = keyof ColorTraits;

export type QuizOption = {
  id: string;
  label: string;
  /** Empty for "Not sure"-style answers: they count as skipped, not neutral. */
  weights: Partial<ColorTraits>;
};

export type QuizQuestion = {
  id: string;
  prompt: string;
  hint?: string;
  options: QuizOption[];
};

export const QUIZ: QuizQuestion[] = [
  {
    id: "veins",
    prompt: "What color are the veins on your inner wrist?",
    hint: "Check in natural daylight.",
    options: [
      { id: "blue", label: "Blue or purple", weights: { warmth: -1 } },
      { id: "green", label: "Green or olive", weights: { warmth: 1 } },
      { id: "mix", label: "A mix, hard to tell", weights: { warmth: 0 } },
    ],
  },
  {
    id: "sun",
    prompt: "How does your skin react to the sun?",
    options: [
      {
        id: "burn",
        label: "Burns easily, rarely tans",
        weights: { warmth: -0.5, depth: -0.5 },
      },
      {
        id: "both",
        label: "Burns, then tans",
        weights: { warmth: 0, depth: 0 },
      },
      {
        id: "tan",
        label: "Tans easily, rarely burns",
        weights: { warmth: 0.5, depth: 0.5 },
      },
    ],
  },
  {
    id: "hair",
    prompt: "What is your natural hair color?",
    hint: "Your roots, if you dye it.",
    options: [
      {
        id: "platinum",
        label: "Platinum or light blonde",
        weights: { depth: -1 },
      },
      {
        id: "golden",
        label: "Golden or strawberry blonde",
        weights: { depth: -0.5, warmth: 0.5 },
      },
      {
        id: "ash",
        label: "Ash blonde or light brown",
        weights: { depth: -0.3, warmth: -0.5, clarity: -0.5 },
      },
      { id: "brown", label: "Medium brown", weights: { depth: 0.2 } },
      {
        id: "auburn",
        label: "Auburn or red",
        weights: { warmth: 1, depth: 0.3 },
      },
      { id: "dark", label: "Dark brown", weights: { depth: 0.7 } },
      { id: "black", label: "Black", weights: { depth: 1, clarity: 0.3 } },
    ],
  },
  {
    id: "eyes",
    prompt: "What color are your eyes?",
    options: [
      {
        id: "grey",
        label: "Grey or soft blue",
        weights: { depth: -0.5, clarity: -0.5, warmth: -0.3 },
      },
      { id: "bright", label: "Bright blue or green", weights: { clarity: 1 } },
      {
        id: "hazel",
        label: "Hazel or soft green",
        weights: { clarity: -0.5, warmth: 0.3 },
      },
      {
        id: "light-brown",
        label: "Light brown or amber",
        weights: { warmth: 0.5 },
      },
      {
        id: "dark-brown",
        label: "Dark brown or black",
        weights: { depth: 0.8, clarity: 0.3 },
      },
    ],
  },
  {
    id: "lips",
    prompt: "What color are your lips with no lipstick or balm?",
    options: [
      {
        id: "pale-pink",
        label: "Pale or light pink",
        weights: { warmth: -0.5 },
      },
      { id: "berry", label: "Rosy or berry pink", weights: { warmth: -1 } },
      { id: "peach", label: "Peachy or coral", weights: { warmth: 1 } },
      { id: "brown", label: "Brownish or deep", weights: { warmth: 0.5 } },
      { id: "unsure", label: "Not sure", weights: {} },
    ],
  },
  {
    id: "foundation",
    prompt: "If you wear foundation, what undertone is your shade?",
    hint: "C or P on the label means cool, W or Y warm, N neutral.",
    options: [
      { id: "cool", label: "Cool or pink", weights: { warmth: -1 } },
      { id: "warm", label: "Warm, yellow or golden", weights: { warmth: 1 } },
      { id: "neutral", label: "Neutral", weights: { warmth: 0 } },
      { id: "none", label: "I don't wear foundation", weights: {} },
    ],
  },
  {
    id: "contrast",
    prompt: "How much do your hair, skin and eyes stand out from each other?",
    options: [
      {
        id: "low",
        label: "Low: they blend together",
        weights: { clarity: -1 },
      },
      { id: "medium", label: "Medium", weights: { clarity: 0 } },
      {
        id: "high",
        label: "High: they stand out from each other",
        weights: { clarity: 1 },
      },
    ],
  },
];

/**
 * Asked after the quiz when there is a selfie. Any problem ticked offers a
 * retake or quiz-only: makeup, filters and odd light skew every photo trait.
 */
export const PHOTO_CHECK = {
  prompt: "About your selfie",
  hint: "Check any that apply.",
  problems: [
    { id: "makeup", label: "I'm wearing makeup or lipstick" },
    { id: "filter", label: "I used a filter or beauty mode" },
    { id: "lighting", label: "The lighting was yellow, dim or uneven" },
    { id: "skin", label: "I'm sick, sunburned or recently tanned" },
  ],
  none: { id: "none", label: "None of these" },
};

export type QuizAnswers = Record<string, string>;

/** Photo analysis result: the same three axes plus how sure the model is. */
export type PhotoTraits = ColorTraits & { confidence: number };

const AXES: Axis[] = ["warmth", "depth", "clarity"];
const clamp = (v: number) => Math.max(-1, Math.min(1, v));

/**
 * Averages each axis over the answered questions that speak to it. A question
 * whose options never mention an axis does not dilute that axis toward zero.
 */
export function scoreQuiz(answers: QuizAnswers): ColorTraits {
  const sums: ColorTraits = { warmth: 0, depth: 0, clarity: 0 };
  const counts: ColorTraits = { warmth: 0, depth: 0, clarity: 0 };
  for (const question of QUIZ) {
    const option = question.options.find((o) => o.id === answers[question.id]);
    if (!option || Object.keys(option.weights).length === 0) continue;
    for (const axis of AXES) {
      const touchesAxis = question.options.some(
        (o) => o.weights[axis] !== undefined,
      );
      if (!touchesAxis) continue;
      sums[axis] += option.weights[axis] ?? 0;
      counts[axis] += 1;
    }
  }
  const mean = (axis: Axis) => (counts[axis] ? sums[axis] / counts[axis] : 0);
  return {
    warmth: mean("warmth"),
    depth: mean("depth"),
    clarity: mean("clarity"),
  };
}

/**
 * Blends quiz and photo traits. The quiz is the stable signal (the user is
 * describing themselves in daylight); the photo is weighted by its own
 * confidence, because lighting and filters can throw it off.
 */
export function combineTraits(
  quiz: ColorTraits | null,
  photo: PhotoTraits | null,
): ColorTraits {
  const QUIZ_WEIGHT = 0.6;
  const photoWeight = photo ? 0.4 * clamp(photo.confidence) : 0;
  const quizWeight = quiz ? QUIZ_WEIGHT : 0;
  const total = quizWeight + photoWeight;
  if (total === 0) return { warmth: 0, depth: 0, clarity: 0 };
  const blend = (axis: Axis) =>
    ((quiz?.[axis] ?? 0) * quizWeight + (photo?.[axis] ?? 0) * photoWeight) /
    total;
  return {
    warmth: blend("warmth"),
    depth: blend("depth"),
    clarity: blend("clarity"),
  };
}

/**
 * Seasons from best to worst fit. Traits are first scaled so the strongest
 * axis reaches 1: averaged answers land well inside -1..1, while every season
 * prototype has a dominant axis at +-1, so unscaled traits would always look
 * "neutral" and drift to the middle seasons. Near-zero traits are left alone
 * rather than amplifying noise.
 */
export function rankSeasons(traits: ColorTraits): SeasonId[] {
  const peak = Math.max(...AXES.map((a) => Math.abs(traits[a])));
  const scale = peak > 0.15 ? 1 / peak : 1;
  const t = {
    warmth: traits.warmth * scale,
    depth: traits.depth * scale,
    clarity: traits.clarity * scale,
  };
  const distance = (id: SeasonId) => {
    const p = SEASONS[id].traits;
    return Math.hypot(
      t.warmth - p.warmth,
      t.depth - p.depth,
      t.clarity - p.clarity,
    );
  };
  return [...SEASON_IDS].sort((a, b) => distance(a) - distance(b));
}
