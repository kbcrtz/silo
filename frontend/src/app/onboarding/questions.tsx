import { router } from "expo-router";
import { useState } from "react";
import { Alert, Text, View } from "react-native";
import { analyzeSelfieOnce } from "@/api/colorAnalysis";
import { PrimaryButton } from "@/components/onboarding/Buttons";
import { Chip } from "@/components/onboarding/Controls";
import { Header, stepBadge } from "@/components/onboarding/Header";
import { Headline } from "@/components/onboarding/Headline";
import { OnboardingScreen } from "@/components/onboarding/OnboardingScreen";
import { combineTraits, rankSeasons } from "@/lib/colorAnalysis";
import { photoUri } from "@/lib/photos";
import {
  adjustForContext,
  isComplete,
  PHOTO_QUESTIONS,
  type PhotoContext,
} from "@/lib/photoContext";
import { useProfile } from "@/store/profile";
import { TYPE } from "@/theme/brand";

/**
 * Step three: how the selfie was taken. The answers correct the photo
 * reading, then this step settles the season and hands over to results.
 */
export default function Questions() {
  const selfie = useProfile((s) => s.selfiePhoto);
  const saved = useProfile((s) => s.photoContext);
  const set = useProfile((s) => s.set);
  const [context, setContext] = useState<PhotoContext>(saved);
  const [busy, setBusy] = useState(false);

  const pick = (patch: PhotoContext) => {
    const next = { ...context, ...patch };
    setContext(next);
    set({ photoContext: next });
  };

  const analyze = async () => {
    if (!selfie) return router.back();
    setBusy(true);
    try {
      const photo = await analyzeSelfieOnce(photoUri(selfie));
      const traits = combineTraits(null, adjustForContext(photo, context));
      const ranked = rankSeasons(traits);
      set({
        photoTraits: photo,
        colorProfile: {
          seasonId: ranked[0],
          ranked,
          traits,
          analyzedAt: new Date().toISOString(),
        },
      });
      router.push("/onboarding/results");
    } catch {
      Alert.alert(
        "Couldn't read your photo",
        "Check your connection and try again, or retake the selfie.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <OnboardingScreen>
      <Header badge={stepBadge(3)} />
      <View style={{ marginTop: 38 }}>
        <Headline
          size="medium"
          gap={4}
          eyebrow="A few final details"
          title={"Help us read your\nphoto *accurately.*"}
        />
      </View>

      {PHOTO_QUESTIONS.map((q, qi) => (
        <View key={q.id} style={{ marginTop: qi === 0 ? 30 : 32 }}>
          <Text style={TYPE.question}>{q.prompt}</Text>
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: 9,
              marginTop: 15,
            }}
          >
            {q.options.map((o) => (
              <Chip
                key={o.id}
                label={o.label}
                selected={context[q.id] === o.id}
                onPress={() => pick({ [q.id]: o.id })}
              />
            ))}
          </View>
        </View>
      ))}

      <PrimaryButton
        label={busy ? "Reading your colors" : "Analyze my colors"}
        onPress={analyze}
        disabled={!isComplete(context)}
        loading={busy}
        style={{ marginTop: 29 }}
      />
    </OnboardingScreen>
  );
}
