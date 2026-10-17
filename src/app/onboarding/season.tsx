import { router } from "expo-router";
import { useEffect } from "react";
import { View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { Chip } from "@/components/Chip";
import { OnboardingStep } from "@/components/OnboardingStep";
import { Swatches } from "@/components/Swatches";
import { Text } from "@/components/Text";
import { SEASONS } from "@/data/seasons";
import { combineTraits, rankSeasons, scoreQuiz } from "@/lib/colorAnalysis";
import { useProfile } from "@/store/profile";
import { useTheme } from "@/theme";

/**
 * Computes the season and stores it on mount. Storing it is what re-themes
 * the app: useTheme() everywhere reads colorProfile, so this screen is the
 * moment Silo turns into the user's colors.
 */
export default function SeasonStep() {
  const t = useTheme();
  const answers = useProfile((s) => s.quizAnswers);
  const photoTraits = useProfile((s) => s.photoTraits);
  const colorProfile = useProfile((s) => s.colorProfile);
  const set = useProfile((s) => s.set);
  const chooseSeason = useProfile((s) => s.chooseSeason);

  useEffect(() => {
    const quiz = Object.keys(answers).length ? scoreQuiz(answers) : null;
    const traits = combineTraits(quiz, photoTraits ?? null);
    const ranked = rankSeasons(traits);
    set({
      colorProfile: {
        seasonId: ranked[0],
        ranked,
        traits,
        analyzedAt: new Date().toISOString(),
      },
    });
  }, [answers, photoTraits, set]);

  if (!colorProfile) return null;
  const season = SEASONS[colorProfile.seasonId];

  return (
    <OnboardingStep
      step="season"
      title={`You're a ${season.name}`}
      subtitle={season.description}
      primary={{
        label: "Continue",
        onPress: () => router.push("/onboarding/measurements"),
      }}
    >
      <Animated.View
        key={season.id}
        entering={FadeIn.duration(500)}
        style={{ gap: t.space(4) }}
      >
        <View style={{ gap: t.space(2) }}>
          <Text variant="heading">Your best colors</Text>
          <Swatches colors={season.best} size={44} animated />
        </View>
        <View style={{ gap: t.space(2) }}>
          <Text variant="heading">Neutrals</Text>
          <Swatches colors={season.neutrals} animated />
        </View>
        <View style={{ gap: t.space(2) }}>
          <Text variant="heading">Go easy on</Text>
          <Swatches colors={season.avoid} crossed />
        </View>
      </Animated.View>

      <View style={{ gap: t.space(2), marginTop: t.space(2) }}>
        <Text variant="caption" tone="muted">
          Not quite you? Close matches:
        </Text>
        <View
          style={{ flexDirection: "row", flexWrap: "wrap", gap: t.space(2) }}
        >
          {colorProfile.ranked.slice(0, 4).map((id) => (
            <Chip
              key={id}
              label={SEASONS[id].name}
              selected={id === season.id}
              onPress={() => chooseSeason(id)}
            />
          ))}
        </View>
      </View>
    </OnboardingStep>
  );
}
