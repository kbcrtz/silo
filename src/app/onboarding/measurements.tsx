import { router } from "expo-router";
import { useMemo, useState } from "react";
import { MeasurementForm } from "@/components/MeasurementForm";
import { OnboardingStep } from "@/components/OnboardingStep";
import { latestMeasurements, type Measurements } from "@/lib/measurements";
import { useMeasurements } from "@/store/measurements";
import { useProfile } from "@/store/profile";

export default function MeasurementsStep() {
  const entries = useMeasurements((s) => s.entries);
  const latest = useMemo(() => latestMeasurements(entries), [entries]);
  const unitSystem = useProfile((s) => s.unitSystem);
  const shopFor = useProfile((s) => s.shopFor);
  const set = useProfile((s) => s.set);
  const [draft, setDraft] = useState<Measurements>(latest);

  const next = () => {
    useMeasurements.getState().record(draft, latest);
    router.push("/onboarding/body-shape");
  };

  return (
    <OnboardingStep
      step="measurements"
      title="Your measurements"
      subtitle="Used for your body shape and size recommendations. A soft tape measure works best; skip any you don't know."
      primary={{ label: "Continue", onPress: next }}
    >
      <MeasurementForm
        initial={latest}
        unitSystem={unitSystem}
        onUnitSystemChange={(u) => set({ unitSystem: u })}
        shopFor={shopFor}
        onChange={setDraft}
      />
    </OnboardingStep>
  );
}
