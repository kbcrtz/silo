import { router } from "expo-router";
import { ChoiceList } from "@/components/ChoiceList";
import { OnboardingStep } from "@/components/OnboardingStep";
import { useProfile, type ShopFor } from "@/store/profile";

const OPTIONS: { id: ShopFor; label: string }[] = [
  { id: "womens", label: "Womenswear" },
  { id: "mens", label: "Menswear" },
  { id: "both", label: "Both" },
];

export default function ShopForStep() {
  const shopFor = useProfile((s) => s.shopFor);
  const set = useProfile((s) => s.set);
  return (
    <OnboardingStep
      step="shop-for"
      title="What do you shop for?"
      subtitle="Sets which cuts and size charts you see."
      primary={{
        label: "Continue",
        onPress: () => router.push("/onboarding/selfie"),
      }}
    >
      <ChoiceList
        options={OPTIONS}
        selected={shopFor}
        onSelect={(id) => set({ shopFor: id as ShopFor })}
      />
    </OnboardingStep>
  );
}
