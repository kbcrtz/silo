import { router } from "expo-router";
import { useMemo } from "react";
import { Card } from "@/components/Card";
import { OnboardingStep } from "@/components/OnboardingStep";
import { Text } from "@/components/Text";
import { bodyShape } from "@/lib/bodyShape";
import { latestMeasurements } from "@/lib/measurements";
import { useMeasurements } from "@/store/measurements";

export default function BodyShapeStep() {
  const entries = useMeasurements((s) => s.entries);
  const shape = useMemo(
    () => bodyShape(latestMeasurements(entries)),
    [entries],
  );
  const next = {
    label: "Continue",
    onPress: () => router.push("/onboarding/body-photo"),
  };

  if (!shape) {
    return (
      <OnboardingStep
        step="body-shape"
        title="Body shape"
        subtitle="Add your chest, waist and hips to see your shape. You can do this later from the Me tab."
        primary={next}
        secondary={{
          label: "Back to measurements",
          onPress: () => router.back(),
        }}
      />
    );
  }

  return (
    <OnboardingStep
      step="body-shape"
      title={`${shape.name} shape`}
      subtitle={shape.description}
      primary={next}
    >
      <Card>
        <Text variant="heading">What tends to work</Text>
        {shape.tips.map((tip) => (
          <Text key={tip}>• {tip}</Text>
        ))}
      </Card>
    </OnboardingStep>
  );
}
