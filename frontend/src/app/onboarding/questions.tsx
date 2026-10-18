import { router } from "expo-router";
import { useState, type ReactNode } from "react";
import { Alert, Text, View } from "react-native";
import { analyzeSelfieOnce } from "@/api/colorAnalysis";
import { PrimaryButton } from "@/components/onboarding/Buttons";
import { Chip } from "@/components/onboarding/Controls";
import { Header, stepBadge } from "@/components/onboarding/Header";
import { Headline } from "@/components/onboarding/Headline";
import { OnboardingScreen } from "@/components/onboarding/OnboardingScreen";
import { analysisErrorMessage } from "@/lib/analysisError";
import { combineTraits, rankSeasons } from "@/lib/colorAnalysis";
import { photoUri } from "@/lib/photos";
import {
  adjustForContext,
  isComplete,
  SELFIE_QUESTION,
  selfReportedTraits,
  toggleSelfieFlag,
  TRAIT_QUESTIONS,
  type PhotoContext,
  type SelfieFlag,
} from "@/lib/photoContext";
import { useProfile } from "@/store/profile";
import { TYPE } from "@/theme/brand";

/**
 * Step three: a few questions about the user's coloring, and a checklist
 * about the selfie. The answers blend with the photo reading (which the
 * checklist corrects), then this step settles the season.
 */
function Question({
  prompt,
  first,
  children,
}: {
  prompt: string;
  first?: boolean;
  children: ReactNode;
}) {
  return (
    <View style={{ marginTop: first ? 30 : 32 }}>
      <Text style={TYPE.question}>{prompt}</Text>
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 9,
          marginTop: 15,
        }}
      >
        {children}
      </View>
    </View>
  );
}

export default function Questions() {
  const selfie = useProfile((s) => s.selfiePhoto);
  const saved = useProfile((s) => s.photoContext);
  const set = useProfile((s) => s.set);
  const [context, setContext] = useState<PhotoContext>(saved);
  const [busy, setBusy] = useState(false);

  const update = (next: PhotoContext) => {
    setContext(next);
    set({ photoContext: next });
  };
  const answer = (question: string, option: string) =>
    update({ ...context, answers: { ...context.answers, [question]: option } });
  const flag = (f: SelfieFlag) =>
    update({ ...context, selfie: toggleSelfieFlag(context.selfie ?? [], f) });

  const analyze = async () => {
    if (!selfie) return router.back();
    setBusy(true);
    try {
      const photo = await analyzeSelfieOnce(photoUri(selfie));
      const traits = combineTraits(
        selfReportedTraits(context),
        adjustForContext(photo, context.selfie),
      );
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
    } catch (e) {
      const { title, body } = analysisErrorMessage(e);
      Alert.alert(title, body);
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

      {TRAIT_QUESTIONS.map((q, qi) => (
        <Question key={q.id} prompt={q.prompt} first={qi === 0}>
          {q.options.map((o) => (
            <Chip
              key={o.id}
              label={o.label}
              selected={context.answers?.[q.id] === o.id}
              onPress={() => answer(q.id, o.id)}
            />
          ))}
        </Question>
      ))}

      <Question prompt={SELFIE_QUESTION.prompt}>
        {SELFIE_QUESTION.options.map((o) => (
          <Chip
            key={o.id}
            label={o.label}
            selected={!!context.selfie?.includes(o.id)}
            onPress={() => flag(o.id)}
          />
        ))}
      </Question>

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
