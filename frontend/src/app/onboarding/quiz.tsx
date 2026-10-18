import { router } from "expo-router";
import { useState } from "react";
import { Alert } from "react-native";
import { ChoiceList } from "@/components/ChoiceList";
import { OnboardingStep } from "@/components/OnboardingStep";
import { Text } from "@/components/Text";
import { PHOTO_CHECK, QUIZ } from "@/lib/colorAnalysis";
import { useProfile } from "@/store/profile";

/**
 * One question at a time; picking an answer advances. With a selfie, a last
 * checklist asks whether anything threw the photo off.
 */
export default function QuizStep() {
  const answers = useProfile((s) => s.quizAnswers);
  const answer = useProfile((s) => s.answer);
  const hasPhoto = useProfile((s) => s.photoTraits !== undefined);
  const set = useProfile((s) => s.set);
  const [index, setIndex] = useState(0);
  const [problems, setProblems] = useState<string[]>([]);
  const total = QUIZ.length + (hasPhoto ? 1 : 0);
  const question = QUIZ[index];

  const next = () =>
    index + 1 < total ? setIndex(index + 1) : router.push("/onboarding/season");

  const select = (optionId: string) => {
    answer(question.id, optionId);
    next();
  };

  const toggle = (id: string) => {
    if (id === PHOTO_CHECK.none.id) return router.push("/onboarding/season");
    setProblems((p) =>
      p.includes(id) ? p.filter((x) => x !== id) : [...p, id],
    );
  };

  const reportProblems = () =>
    Alert.alert(
      "Your selfie may be off",
      "Makeup, filters and odd lighting change how your coloring reads. Retake it, or continue with the quiz only.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Retake selfie",
          onPress: () => router.navigate("/onboarding/selfie"),
        },
        {
          text: "Quiz only",
          onPress: () => {
            set({ photoTraits: undefined });
            router.push("/onboarding/season");
          },
        },
      ],
    );

  return (
    <OnboardingStep
      step="quiz"
      title={question ? question.prompt : PHOTO_CHECK.prompt}
      subtitle={question ? question.hint : PHOTO_CHECK.hint}
      primary={
        question
          ? undefined
          : {
              label: "Continue",
              onPress: reportProblems,
              disabled: problems.length === 0,
            }
      }
      secondary={
        index > 0
          ? { label: "Back", onPress: () => setIndex(index - 1) }
          : { label: "Back", onPress: () => router.back() }
      }
    >
      <Text variant="caption" tone="muted">
        Question {index + 1} of {total}
      </Text>
      {question ? (
        <ChoiceList
          options={question.options}
          selected={answers[question.id]}
          onSelect={select}
        />
      ) : (
        <ChoiceList
          options={[...PHOTO_CHECK.problems, PHOTO_CHECK.none]}
          selected={problems}
          onSelect={toggle}
        />
      )}
    </OnboardingStep>
  );
}
