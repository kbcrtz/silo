import { DEMO_ANSWERS } from "@/data/demo";
import {
  combineTraits,
  QUIZ,
  rankSeasons,
  scoreQuiz,
  type QuizAnswers,
} from "../colorAnalysis";

// Strongly warm and moderately soft: sits between True and Soft Autumn.
const warmSoftMedium: QuizAnswers = {
  veins: "green",
  sun: "both",
  hair: "brown",
  eyes: "hazel",
  lips: "peach",
  foundation: "warm",
  contrast: "low",
};

const coolDeepClear: QuizAnswers = {
  veins: "blue",
  sun: "both",
  hair: "black",
  eyes: "dark-brown",
  lips: "berry",
  foundation: "cool",
  contrast: "high",
};

const coolLight: QuizAnswers = {
  veins: "blue",
  sun: "burn",
  hair: "platinum",
  eyes: "grey",
  lips: "pale-pink",
  foundation: "none",
  contrast: "medium",
};

describe("scoreQuiz", () => {
  it("reads warm answers as positive warmth", () => {
    expect(scoreQuiz(warmSoftMedium).warmth).toBeGreaterThan(0.3);
    expect(scoreQuiz(coolDeepClear).warmth).toBeLessThan(-0.3);
  });

  it("ignores unanswered questions instead of pulling toward zero", () => {
    expect(scoreQuiz({ foundation: "warm" }).warmth).toBe(1);
    expect(scoreQuiz({})).toEqual({ warmth: 0, depth: 0, clarity: 0 });
  });

  it('treats "Not sure" and "I don\'t wear foundation" as skipped, not neutral', () => {
    expect(
      scoreQuiz({ veins: "green", lips: "unsure", foundation: "none" }).warmth,
    ).toBe(1);
  });

  it("asks only factual questions, never which colors look better on you", () => {
    expect(QUIZ.map((q) => q.id)).toEqual([
      "veins",
      "sun",
      "hair",
      "eyes",
      "lips",
      "foundation",
      "contrast",
    ]);
  });

  it("only uses option ids that exist", () => {
    for (const q of QUIZ)
      expect(new Set(q.options.map((o) => o.id)).size).toBe(q.options.length);
  });
});

describe("rankSeasons", () => {
  it("places archetypal answers in the expected family", () => {
    expect(rankSeasons(scoreQuiz(warmSoftMedium))[0]).toMatch(/autumn/);
    expect(rankSeasons(scoreQuiz(DEMO_ANSWERS))[0]).toBe("soft-autumn");
    expect(rankSeasons(scoreQuiz(coolDeepClear))[0]).toMatch(/winter/);
    expect(rankSeasons(scoreQuiz(coolLight))[0]).toBe("light-summer");
  });

  it("returns all twelve seasons", () => {
    expect(new Set(rankSeasons({ warmth: 0, depth: 0, clarity: 0 })).size).toBe(
      12,
    );
  });
});

describe("combineTraits", () => {
  it("uses whichever source exists on its own", () => {
    const photo = { warmth: 0.5, depth: -0.5, clarity: 0.2, confidence: 0.8 };
    expect(combineTraits(null, photo)).toEqual({
      warmth: 0.5,
      depth: -0.5,
      clarity: 0.2,
    });
    expect(
      combineTraits({ warmth: -1, depth: 0, clarity: 0 }, null).warmth,
    ).toBe(-1);
  });

  it("lets the quiz outweigh a low-confidence photo", () => {
    const quiz = { warmth: 1, depth: 0, clarity: 0 };
    const photo = { warmth: -1, depth: 0, clarity: 0, confidence: 0.3 };
    expect(combineTraits(quiz, photo).warmth).toBeGreaterThan(0.5);
  });
});
