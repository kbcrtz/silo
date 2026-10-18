import { Image } from "expo-image";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  LinearTransition,
  ZoomIn,
} from "react-native-reanimated";
import { GlassButton, PrimaryButton } from "@/components/onboarding/Buttons";
import { Glass } from "@/components/onboarding/Glass";
import { Header, stepBadge } from "@/components/onboarding/Header";
import { renderEmphasis } from "@/components/onboarding/Headline";
import { MetalOrb } from "@/components/onboarding/MetalOrb";
import { OnboardingScreen } from "@/components/onboarding/OnboardingScreen";
import { FAMILIES, familyOf, METALS, type Metal } from "@/data/families";
import { photoUri } from "@/lib/photos";
import { traitWords } from "@/lib/photoContext";
import { useProfile } from "@/store/profile";
import { BRAND, TYPE } from "@/theme/brand";

/** How long the analysis summary shows before the season takes over. */
const REVEAL_MS = 1900;
const SWATCH = 55;
const layout = LinearTransition.springify().damping(18);

function Swatch({ color, index }: { color: string; index: number }) {
  return (
    <Animated.View
      entering={ZoomIn.delay(250 + index * 30)
        .springify()
        .damping(13)}
      style={{
        width: SWATCH,
        height: SWATCH,
        borderRadius: SWATCH / 2,
        backgroundColor: color,
        borderWidth: 1.5,
        borderColor: "rgba(255,255,255,0.5)",
        shadowColor: BRAND.shadow,
        shadowOpacity: 0.14,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
      }}
    />
  );
}

/** The portrait disc: the selfie behind a white ring, or plain glass. */
function Portrait({ selfie }: { selfie?: string }) {
  const size = 95;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 5,
        borderColor: "rgba(255,255,255,0.92)",
        overflow: "hidden",
        backgroundColor: "rgba(255,255,255,0.5)",
      }}
    >
      {selfie ? (
        <Image
          source={photoUri(selfie)}
          style={{ flex: 1 }}
          contentFit="cover"
        />
      ) : null}
    </View>
  );
}

/**
 * Step four: the result. It opens on the analysis summary over the neutral
 * gradient, then the background turns into the season's and the summary
 * gives way to the best metal and what to do next.
 */
export default function Results() {
  const colorProfile = useProfile((s) => s.colorProfile);
  const name = useProfile((s) => s.displayName);
  const selfie = useProfile((s) => s.selfiePhoto);
  const [revealed, setRevealed] = useState(false);
  const [preview, setPreview] = useState<Metal | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setRevealed(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }, REVEAL_MS);
    return () => clearTimeout(timer);
  }, []);

  if (!colorProfile) return null;
  const family = FAMILIES[familyOf(colorProfile.seasonId)];
  const best = family.metal;
  const shown = preview ?? best;
  const other: Metal = best === "gold" ? "silver" : "gold";
  const lead = name?.trim() ? `${name.trim()}, you’re a` : "You’re a";

  return (
    <OnboardingScreen backdrop={revealed ? family.id : "neutral"}>
      <Header wordmark badge={stepBadge(4)} />

      <View style={{ marginTop: 26 }}>
        <Text style={TYPE.eyebrow}>YOUR COLOR ANALYSIS</Text>
        <Text style={[TYPE.title, { marginTop: 4 }]} accessibilityRole="header">
          {renderEmphasis(
            `${lead}\n*${family.temperature}*\n*${family.season}.*`,
            TYPE.title,
          )}
        </Text>
        <Animated.View
          entering={FadeIn.delay(150).duration(600)}
          style={{ position: "absolute", right: 0, top: 139 }}
        >
          <Portrait selfie={selfie} />
        </Animated.View>
      </View>

      <Animated.View layout={layout} style={{ marginTop: 19 }}>
        <Glass
          radius={34}
          style={{ padding: 21, paddingTop: revealed ? 20 : 24 }}
        >
          {revealed ? null : (
            <Animated.View
              exiting={FadeOut.duration(250)}
              style={{ marginBottom: 33 }}
            >
              <Text style={[TYPE.traits, { color: BRAND.inkMuted }]}>
                {traitWords(colorProfile.traits).join(" · ").toUpperCase()}
              </Text>
              <Text
                style={[
                  TYPE.body,
                  { color: "rgba(23,19,17,0.7)", marginTop: 14 },
                ]}
              >
                {family.description}
              </Text>
            </Animated.View>
          )}
          <Animated.View
            layout={layout}
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              justifyContent: "space-between",
              rowGap: 21,
            }}
          >
            {family.palette.map((c, i) => (
              <Swatch key={c + i} color={c} index={i} />
            ))}
          </Animated.View>
        </Glass>
      </Animated.View>

      {revealed ? (
        <>
          <Animated.View
            entering={FadeInDown.delay(250).duration(500)}
            style={{ marginTop: 25 }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityHint="Compare gold and silver"
              onPress={() => {
                Haptics.selectionAsync();
                setPreview(shown === best ? other : null);
              }}
            >
              <Glass
                radius={34}
                fill={BRAND.glassFillStrong}
                style={{
                  height: 115,
                  flexDirection: "row",
                  alignItems: "center",
                  paddingLeft: 17,
                  paddingRight: 24,
                }}
              >
                <Animated.View
                  key={shown}
                  entering={ZoomIn.springify().damping(14)}
                >
                  <MetalOrb metal={shown} />
                </Animated.View>
                <View style={{ flex: 1, marginLeft: 17 }}>
                  <Text style={[TYPE.metalLabel, { color: BRAND.inkMuted }]}>
                    {shown === best ? "YOUR BEST METAL" : "JEWELRY PREVIEW"}
                  </Text>
                  <Text style={[TYPE.metal, { marginTop: 6 }]}>
                    {METALS[shown].name}
                  </Text>
                  <Text
                    style={[
                      TYPE.metalBody,
                      { color: BRAND.inkSoft, marginTop: 4 },
                    ]}
                  >
                    {METALS[shown].description}
                  </Text>
                </View>
              </Glass>
            </Pressable>
          </Animated.View>

          <Animated.View
            entering={FadeInDown.delay(400).duration(500)}
            style={{ flexDirection: "row", gap: 13, marginTop: 16 }}
          >
            <GlassButton
              label="Try another photo"
              onPress={() => router.navigate("/onboarding/selfie")}
              style={{ flex: 1 }}
            />
            <PrimaryButton
              label="Build my wardrobe"
              arrow={false}
              onPress={() => router.push("/onboarding/body-profile")}
              style={{ flex: 1 }}
            />
          </Animated.View>
        </>
      ) : null}
    </OnboardingScreen>
  );
}
