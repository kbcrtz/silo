import {
  combineTraits,
  rankSeasons,
  scoreQuiz,
  type QuizAnswers,
} from "@/lib/colorAnalysis";
import type {
  MeasurementEntry,
  Measurements,
  MeasurementType,
} from "@/lib/measurements";
import { useMeasurements } from "@/store/measurements";
import { useProfile } from "@/store/profile";

/** Clearly soft and warm-leaning; tested to land on Soft Autumn. */
export const DEMO_ANSWERS: QuizAnswers = {
  veins: "mix",
  jewelry: "gold",
  sun: "both",
  hair: "brown",
  eyes: "hazel",
  contrast: "low",
  white: "cream",
};

/** Two check-ins a month apart, so the history screen has something to show. */
const DEMO_HISTORY: { daysAgo: number; values: Measurements }[] = [
  {
    daysAgo: 35,
    values: {
      height: 168,
      weight: 64,
      chest: 90,
      waist: 73,
      hips: 99,
      inseam: 78,
      armLength: 58,
    },
  },
  { daysAgo: 3, values: { weight: 62.5, chest: 89, waist: 71 } },
];

/**
 * Skips onboarding with a finished Soft Autumn profile, for demos that start
 * from a fresh install.
 */
export function loadDemoProfile() {
  const quizTraits = scoreQuiz(DEMO_ANSWERS);
  const photoTraits = {
    warmth: 0.4,
    depth: 0.1,
    clarity: -0.5,
    confidence: 0.6,
  };
  const traits = combineTraits(quizTraits, photoTraits);
  const ranked = rankSeasons(traits);

  const entries: MeasurementEntry[] = DEMO_HISTORY.flatMap(
    ({ daysAgo, values }) => {
      const measuredAt = new Date(
        Date.now() - daysAgo * 86_400_000,
      ).toISOString();
      return (Object.entries(values) as [MeasurementType, number][]).map(
        ([type, value]) => ({
          id: `${type}-${measuredAt}`,
          type,
          value,
          measuredAt,
        }),
      );
    },
  );
  useMeasurements.getState().replaceAll(entries);

  useProfile.getState().set({
    shopFor: "both",
    quizAnswers: DEMO_ANSWERS,
    photoTraits,
    colorProfile: {
      seasonId: ranked[0],
      ranked,
      traits,
      analyzedAt: new Date().toISOString(),
    },
    onboarded: true,
  });
}
