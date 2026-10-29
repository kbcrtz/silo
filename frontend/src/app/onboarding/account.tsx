import { router, useLocalSearchParams } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { Header } from "@/components/onboarding/Header";
import { Headline } from "@/components/onboarding/Headline";
import { OnboardingScreen } from "@/components/onboarding/OnboardingScreen";
import { SignInButtons } from "@/components/SignInButtons";
import { useProfile } from "@/store/profile";
import { BRAND, TYPE } from "@/theme/brand";

/**
 * Sign-up, between the passport and the paywall: links Apple or Google to
 * the phone's anonymous user so the profile, measurements and saved pieces
 * come back on a new phone. With `?returning=1` (from the first step) it signs a returning
 * shopper in instead; a restored profile is onboarded, and the root stack
 * moves to home on its own.
 */
export default function AccountStep() {
  const { returning } = useLocalSearchParams<{ returning?: string }>();

  // A restored profile is onboarded, and the root stack moves home itself.
  const done = returning
    ? () => {
        if (!useProfile.getState().onboarded) router.back();
      }
    : () => router.push("/onboarding/paywall");
  const skip = returning
    ? () => router.back()
    : () => router.push("/onboarding/paywall");

  return (
    <OnboardingScreen contentStyle={{ gap: 20 }}>
      <Header badge={returning ? "SIGN IN" : "SILO ID"} />
      <View style={{ marginTop: 96 }}>
        <Headline
          eyebrow={returning ? "Good to see you" : "Keep your passport"}
          title={returning ? "Welcome\n*back.*" : "Save your\n*Silo.*"}
        />
      </View>
      <Text style={[TYPE.body, { color: BRAND.inkSoft }]}>
        {returning
          ? "Sign in to bring back your colors, measurements and saved pieces."
          : "Sign in to back up your colors, measurements and saved pieces, and get them back on any iPhone."}
      </Text>

      <View style={{ marginTop: "auto", gap: 16 }}>
        <SignInButtons onSignedIn={done} />
        <Pressable
          accessibilityRole="button"
          onPress={skip}
          hitSlop={8}
          style={{ alignSelf: "center", padding: 8 }}
        >
          <Text style={[TYPE.control, { color: BRAND.inkSoft }]}>
            {returning ? "Back" : "Not now"}
          </Text>
        </Pressable>
      </View>
    </OnboardingScreen>
  );
}
