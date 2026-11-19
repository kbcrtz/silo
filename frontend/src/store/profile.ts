import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ColorTraits, SeasonId } from "@/data/seasons";
import type { PhotoTraits, QuizAnswers } from "@/lib/colorAnalysis";
import type { FitPreference } from "@/lib/fit";
import type { PhotoContext } from "@/lib/photoContext";
import type { StatedTaste } from "@/lib/taste";
import type { UnitSystem } from "@/lib/units";
import { storage } from "./storage";

export type ShopFor = "womens" | "mens" | "both";
export type Gender = "woman" | "man" | "non-binary" | "unsaid";

/** Which cuts and size charts a gender starts from. */
export function shopForGender(gender: Gender): ShopFor {
  return gender === "woman" ? "womens" : gender === "man" ? "mens" : "both";
}

export type ColorProfile = {
  seasonId: SeasonId;
  /** Every season, best fit first. */
  ranked: SeasonId[];
  traits: ColorTraits;
  analyzedAt: string;
};

type ProfileState = {
  onboarded: boolean;
  shopFor: ShopFor;
  /** Printed on the passport card. */
  displayName?: string;
  age?: number;
  gender?: Gender;
  /** File names from lib/photos, not uris. */
  selfiePhoto?: string;
  /** The selfie file the server has a copy of (PUT /me/photo), so it's uploaded once per change. */
  photoSynced?: string;
  photoTraits?: PhotoTraits;
  /** Answers about how the selfie was taken; they correct photoTraits. */
  photoContext: PhotoContext;
  quizAnswers: QuizAnswers;
  colorProfile?: ColorProfile;
  unitSystem: UnitSystem;
  fitPreference: FitPreference;
  /**
   * The shopper's style: the looks they picked and how they wear color.
   * Backed up with the profile, so a new phone keeps it; "Redo onboarding"
   * keeps it too, and the style step starts from it.
   */
  taste?: {
    stated?: StatedTaste;
    /** When the feed's "Tell us your style" card was dismissed. */
    promptDismissedAt?: string;
  };

  set: (patch: Partial<Omit<ProfileState, "set" | "answer" | "reset">>) => void;
  answer: (questionId: string, optionId: string) => void;
  reset: () => void;
};

const initial = {
  onboarded: false,
  shopFor: "both" as ShopFor,
  quizAnswers: {},
  photoContext: {},
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
      reset: () =>
        set({
          ...initial,
          displayName: undefined,
          age: undefined,
          gender: undefined,
          selfiePhoto: undefined,
          photoSynced: undefined,
          photoTraits: undefined,
          colorProfile: undefined,
          taste: undefined,
        }),
    }),
    { name: "silo.profile", storage },
  ),
);
