import { router } from "expo-router";
import { useState } from "react";
import { ChoiceList } from "@/components/ChoiceList";
import { OnboardingStep } from "@/components/OnboardingStep";
import { Text } from "@/components/Text";
import { QUIZ } from "@/lib/colorAnalysis";
import { useProfile } from "@/store/profile";

/** One question at a time; picking an answer advances. */
export default function QuizStep() {
  const answers = useProfile((s) => s.quizAnswers);
  const answer = useProfile((s) => s.answer);
  const [index, setIndex] = useState(0);
  const question = QUIZ[index];
  const isLast = index === QUIZ.length - 1;

  const select = (optionId: string) => {
    answer(question.id, optionId);
    if (isLast) router.push("/onboarding/season");
    else setIndex(index + 1);
  };

  return (
    <OnboardingStep
      step="quiz"
      title={question.prompt}
      subtitle={question.hint}
      secondary={
        index > 0
          ? { label: "Back", onPress: () => setIndex(index - 1) }
          : { label: "Back", onPress: () => router.back() }
      }
    >
      <Text variant="caption" tone="muted">
        Question {index + 1} of {QUIZ.length}
      </Text>
      <ChoiceList
        options={question.options}
        selected={answers[question.id]}
        onSelect={select}
      />
    </OnboardingStep>
  );
}
