import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ColorTraits, SeasonId } from "@/data/seasons";
import type { PhotoTraits, QuizAnswers } from "@/lib/colorAnalysis";
import type { FitPreference } from "@/lib/fit";
import type { UnitSystem } from "@/lib/units";
import { storage } from "./storage";

export type ShopFor = "womens" | "mens" | "both";

export type ColorProfile = {
  seasonId: SeasonId;
  /** Every season, best fit first; powers "not quite? try…". */
  ranked: SeasonId[];
  traits: ColorTraits;
  analyzedAt: string;
};

type ProfileState = {
  onboarded: boolean;
  shopFor: ShopFor;
  /** File names from lib/photos, not uris. */
  selfiePhoto?: string;
  bodyPhoto?: string;
  photoTraits?: PhotoTraits;
  quizAnswers: QuizAnswers;
  colorProfile?: ColorProfile;
  unitSystem: UnitSystem;
  fitPreference: FitPreference;

  set: (
    patch: Partial<
      Omit<ProfileState, "set" | "answer" | "chooseSeason" | "reset">
    >,
  ) => void;
  answer: (questionId: string, optionId: string) => void;
  /** Manual override from the ranked list; keeps the analysis itself. */
  chooseSeason: (seasonId: SeasonId) => void;
  reset: () => void;
};

const initial = {
  onboarded: false,
  shopFor: "both" as ShopFor,
  quizAnswers: {},
  unitSystem: "imperial" as UnitSystem,
  fitPreference: "regular" as FitPreference,
};

export const useProfile = create<ProfileState>()(
  persist(
    (set) => ({
      ...initial,
      set: (patch) => set(patch),
      answer: (questionId, optionId) =>
        set((s) => ({
          quizAnswers: { ...s.quizAnswers, [questionId]: optionId },
        })),
      chooseSeason: (seasonId) =>
        set((s) =>
          s.colorProfile
            ? { colorProfile: { ...s.colorProfile, seasonId } }
            : s,
        ),
      reset: () =>
        set({
          ...initial,
          selfiePhoto: undefined,
          bodyPhoto: undefined,
          photoTraits: undefined,
          colorProfile: undefined,
        }),
    }),
    { name: "silo.profile", storage },
  ),
);
