import { router, useLocalSearchParams } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { useMembership } from "@/api/purchases";
import { Header } from "@/components/onboarding/Header";
import { Headline } from "@/components/onboarding/Headline";
import { OnboardingScreen } from "@/components/onboarding/OnboardingScreen";
import { SignInButtons } from "@/components/SignInButtons";
import { familyOf } from "@/data/families";
import { useProfile } from "@/store/profile";
import { BRAND, TYPE } from "@/theme/brand";

/**
 * Sign-up, between the passport and the paywall: links Apple or Google to
 * the phone's anonymous user so the profile, measurements and saved pieces
 * come back on a new phone. Everyone signs in; there is no skipping it. With
 * `?returning=1` (from the first step) it signs a returning shopper in
 * instead. Onboarded users without an account land here from the opening.
 * Either way, once signed in and onboarded the root stack moves home itself.
 */
export default function AccountStep() {
  const { returning } = useLocalSearchParams<{ returning?: string }>();
  // The season's gradient once there is one; a returning shopper has none yet.
  const seasonId = useProfile((s) => s.colorProfile?.seasonId);

  // Onboarded (restored, or from before sign-in was required): the root stack moves home itself.
  const done = () => {
    if (useProfile.getState().onboarded) return;
    // A returning shopper already paying goes straight in.
    if (useMembership.getState().active)
      return useProfile.getState().set({ onboarded: true });
    if (returning) router.back();
    else router.push("/onboarding/paywall");
  };
  // Sent here from the opening, there's nothing to go back to.
  const canGoBack = router.canGoBack();

  return (
    <OnboardingScreen
      backdrop={seasonId ? familyOf(seasonId) : "neutral"}
      contentStyle={{ gap: 20 }}
    >
      <Header badge={returning ? "SIGN IN" : "SILO ID"} wordmark={!canGoBack} />
      <View style={{ marginTop: 96 }}>
        <Headline
          eyebrow={returning ? "Good to see you" : "Keep your passport"}
          title={returning ? "Welcome\n*back.*" : "Save your\n*Silo.*"}
        />
      </View>
      <Text style={[TYPE.body, { color: BRAND.inkSoft }]}>
        {returning
          ? "Sign in to bring back your colors, measurements and saved pieces."
          : "Sign in to keep your colors, measurements and saved pieces, and get them back on any iPhone."}
      </Text>

      <View style={{ marginTop: "auto", gap: 16 }}>
        <SignInButtons onSignedIn={done} />
        {returning ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.back()}
            hitSlop={8}
            style={{ alignSelf: "center", padding: 8 }}
          >
            <Text style={[TYPE.control, { color: BRAND.inkSoft }]}>Back</Text>
          </Pressable>
        ) : null}
      </View>
    </OnboardingScreen>
  );
}
