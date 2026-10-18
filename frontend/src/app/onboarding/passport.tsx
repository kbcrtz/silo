import * as Haptics from "expo-haptics";
import { useEffect, useState } from "react";
import { TextInput, useWindowDimensions, View } from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  SlideInDown,
  ZoomIn,
} from "react-native-reanimated";
import { ProductImage } from "@/components/ItemCard";
import { OnboardingStep } from "@/components/OnboardingStep";
import { CARD_ASPECT, PassportCard } from "@/components/passport/PassportCard";
import { usePassportData } from "@/components/passport/usePassportData";
import { Text } from "@/components/Text";
import { useRecommendations } from "@/hooks/useRecommendations";
import { useProfile } from "@/store/profile";
import { useTheme } from "@/theme";

/** When the "ISSUED" stamp lands, after the card has slid up. */
const STAMP_AT_MS = 900;
/** How long the stamp stays: it sits flat over a card that can turn, so it leaves. */
const STAMP_FOR_MS = 1600;
/** A pick at or above this score counts toward "N pieces picked for you". */
const GOOD_PICK = 70;

/**
 * Onboarding's finale: the passport is "issued" with everything collected so
 * far. The card slides up and its foil sweeps (PassportCard does that on
 * mount), a stamp lands with a haptic, and the user can put their name on it.
 * Below it, a first look at the feed shows what all those answers bought them.
 */
export default function PassportStep() {
  const t = useTheme();
  const { width } = useWindowDimensions();
  const data = usePassportData();
  const displayName = useProfile((s) => s.displayName);
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
    <OnboardingStep
      step="passport"
      title="Your Silo passport"
      subtitle="Your colors, your fit, all in one place. Tilt to see it shimmer."
      primary={{ label: "Enter Silo", onPress: finish }}
    >
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

      <Animated.View
        entering={FadeIn.delay(STAMP_AT_MS + 300)}
        style={{ gap: t.space(2) }}
      >
        <Text variant="caption" tone="muted">
          NAME ON YOUR PASSPORT
        </Text>
        <TextInput
          value={displayName ?? ""}
          onChangeText={(name) => set({ displayName: name })}
          placeholder="Your name"
          placeholderTextColor={t.colors.textMuted}
          autoCapitalize="words"
          returnKeyType="done"
          maxLength={24}
          style={{
            ...t.type.body,
            color: t.colors.text,
            backgroundColor: t.colors.surface,
            borderColor: t.colors.border,
            borderWidth: 1,
            borderRadius: t.radius.sm,
            padding: t.space(3),
          }}
        />
      </Animated.View>

      {preview.length ? (
        <Animated.View
          entering={FadeIn.delay(STAMP_AT_MS + 700)}
          style={{ gap: t.space(2) }}
        >
          <Text variant="heading">
            {goodPicks || preview.length} pieces already picked for you
          </Text>
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
          <Text tone="muted">
            Ranked by your colors and your shape. Try any of them on your
            mannequin.
          </Text>
        </Animated.View>
      ) : null}
      <View style={{ height: t.space(2) }} />
    </OnboardingStep>
  );
}
