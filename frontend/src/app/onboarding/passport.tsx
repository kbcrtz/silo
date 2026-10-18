import * as Haptics from "expo-haptics";
import { useEffect, useState } from "react";
import { Text as RNText, useWindowDimensions, View } from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  SlideInDown,
  ZoomIn,
} from "react-native-reanimated";
import { ProductImage } from "@/components/ItemCard";
import { PrimaryButton } from "@/components/onboarding/Buttons";
import { Header } from "@/components/onboarding/Header";
import { Headline } from "@/components/onboarding/Headline";
import { OnboardingScreen } from "@/components/onboarding/OnboardingScreen";
import { CARD_ASPECT, PassportCard } from "@/components/passport/PassportCard";
import { usePassportData } from "@/components/passport/usePassportData";
import { Text } from "@/components/Text";
import { useRecommendations } from "@/hooks/useRecommendations";
import { useProfile } from "@/store/profile";
import { familyOf } from "@/data/families";
import { useTheme } from "@/theme";
import { BRAND, TYPE } from "@/theme/brand";

/** When the "ISSUED" stamp lands, after the card has slid up. */
const STAMP_AT_MS = 900;
/** How long the stamp stays: it sits flat over a card that can turn, so it leaves. */
const STAMP_FOR_MS = 1600;
/** A pick at or above this score counts toward "N pieces picked for you". */
const GOOD_PICK = 70;

/**
 * Onboarding's finale: the passport is "issued" with everything collected so
 * far. The card slides up and its foil sweeps (PassportCard does that on
 * mount) and a stamp lands with a haptic.
 * Below it, a first look at the feed shows what all those answers bought them.
 */
export default function PassportStep() {
  const t = useTheme();
  const { width } = useWindowDimensions();
  const data = usePassportData();
  const seasonId = useProfile((s) => s.colorProfile?.seasonId);
  const set = useProfile((s) => s.set);
  const [stamp, setStamp] = useState(false);
  const { ranked } = useRecommendations();
  const goodPicks = ranked.filter((r) => r.score >= GOOD_PICK).length;
  const preview = ranked.slice(0, 4);

  // Narrower than the profile's card so the picks below start on screen.
  const cardWidth = Math.min(width - t.space(10), 290);
  const thumb = (width - t.space(10) - t.space(2) * 3) / 4;

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

  // Setting onboarded swaps the root stack's protected groups; the router
  // moves to the tabs on its own.
  const finish = () => set({ onboarded: true });

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
          entering={SlideInDown.springify().damping(16)}
          style={{
            alignSelf: "center",
            width: cardWidth,
            height: cardWidth * CARD_ASPECT,
          }}
        >
          <PassportCard data={data} width={cardWidth} />
          {stamp ? (
            <Animated.View
              pointerEvents="none"
              entering={ZoomIn.springify().damping(9)}
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

      {preview.length ? (
        <Animated.View
          entering={FadeIn.delay(STAMP_AT_MS + 700)}
          style={{ gap: t.space(2) }}
        >
          <RNText style={TYPE.question}>
            {goodPicks || preview.length} pieces already picked for you
          </RNText>
          <View style={{ flexDirection: "row", gap: t.space(2) }}>
            {preview.map(({ item }) => (
              <View
                key={item.id}
                style={{
                  width: thumb,
                  height: thumb * 1.3,
                  borderRadius: t.radius.sm,
                  overflow: "hidden",
                  backgroundColor: item.colors[0],
                }}
              >
                <ProductImage item={item} />
              </View>
            ))}
          </View>
          <RNText style={[TYPE.body, { color: BRAND.inkSoft }]}>
            Ranked by your colors and your shape. Try any of them on your
            mannequin.
          </RNText>
        </Animated.View>
      ) : null}
      <PrimaryButton label="Enter Silo" onPress={finish} />
    </OnboardingScreen>
  );
}
