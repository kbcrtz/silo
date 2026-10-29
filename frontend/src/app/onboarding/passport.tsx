import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { useWindowDimensions } from "react-native";
import Animated, { FadeIn, FadeInDown, FadeOut } from "react-native-reanimated";
import { PrimaryButton } from "@/components/onboarding/Buttons";
import { Header } from "@/components/onboarding/Header";
import { Headline } from "@/components/onboarding/Headline";
import { OnboardingScreen } from "@/components/onboarding/OnboardingScreen";
import { CARD_ASPECT, PassportCard } from "@/components/passport/PassportCard";
import { usePassportData } from "@/components/passport/usePassportData";
import { Text } from "@/components/Text";
import { useAccount } from "@/store/account";
import { useProfile } from "@/store/profile";
import { familyOf } from "@/data/families";
import { useTheme } from "@/theme";

/** When the "ISSUED" stamp lands, after the card has slid up. */
const STAMP_AT_MS = 900;
/** How long the stamp stays: it sits flat over a card that can turn, so it leaves. */
const STAMP_FOR_MS = 1600;

/**
 * Onboarding's finale: the passport is "issued" with everything collected so
 * far. The card slides up and its foil sweeps (PassportCard does that on
 * mount) and a stamp lands with a haptic.
 */
export default function PassportStep() {
  const t = useTheme();
  const { width } = useWindowDimensions();
  const data = usePassportData();
  const seasonId = useProfile((s) => s.colorProfile?.seasonId);
  const member = useAccount((s) => s.account.kind === "member");
  const [stamp, setStamp] = useState(false);

  const cardWidth = Math.min(width - t.space(10), 290);

  useEffect(() => {
    const show = setTimeout(() => {
      setStamp(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }, STAMP_AT_MS);
    const hide = setTimeout(() => setStamp(false), STAMP_AT_MS + STAMP_FOR_MS);
    return () => {
      clearTimeout(show);
      clearTimeout(hide);
    };
  }, []);

  // Sign-up comes next unless already signed in; the paywall ends onboarding.
  const finish = () =>
    router.push(member ? "/onboarding/paywall" : "/onboarding/account");

  return (
    <OnboardingScreen
      backdrop={seasonId ? familyOf(seasonId) : "neutral"}
      contentStyle={{ gap: t.space(5) }}
    >
      <Header wordmark badge="SILO ID" />
      <Headline
        size="medium"
        eyebrow="Your colors, your fit"
        title={"Your Silo\n*passport.*"}
      />
      {data ? (
        <Animated.View
          entering={FadeInDown.duration(500)}
          // Centered in the space between the title and the button, which
          // its auto margins also push to the bottom of the screen.
          style={{
            alignSelf: "center",
            marginVertical: "auto",
            width: cardWidth,
            height: cardWidth * CARD_ASPECT,
          }}
        >
          <PassportCard data={data} width={cardWidth} />
          {stamp ? (
            <Animated.View
              pointerEvents="none"
              entering={FadeIn.duration(300)}
              exiting={FadeOut.duration(400)}
              style={{
                position: "absolute",
                right: cardWidth * 0.08,
                bottom: cardWidth * 0.32,
                paddingHorizontal: t.space(4),
                paddingVertical: t.space(2),
                borderWidth: 3,
                borderColor: t.colors.accentText,
                borderRadius: t.radius.sm,
                transform: [{ rotate: "-12deg" }],
                backgroundColor: "rgba(255,255,255,0.35)",
              }}
            >
              <Text variant="title" tone="accent" style={{ letterSpacing: 4 }}>
                ISSUED
              </Text>
            </Animated.View>
          ) : null}
        </Animated.View>
      ) : (
        <Text tone="muted">
          Finish color analysis first to get your passport.
        </Text>
      )}

      <PrimaryButton label="Enter Silo" onPress={finish} />
    </OnboardingScreen>
  );
}
