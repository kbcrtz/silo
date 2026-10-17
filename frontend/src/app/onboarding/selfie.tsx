import { Image } from "expo-image";
import { router } from "expo-router";
import { useState } from "react";
import { Alert, View } from "react-native";
import { analyzeSelfie } from "@/api/colorAnalysis";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { OnboardingStep } from "@/components/OnboardingStep";
import { Text } from "@/components/Text";
import { persistPhoto, photoUri } from "@/lib/photos";
import { pickPhoto } from "@/lib/pickPhoto";
import { useProfile } from "@/store/profile";
import { useTheme } from "@/theme";

const TIPS = [
  "Face a window, in daylight",
  "No filters or heavy makeup",
  "Hair pulled back from your face",
];

export default function SelfieStep() {
  const t = useTheme();
  const selfie = useProfile((s) => s.selfiePhoto);
  const set = useProfile((s) => s.set);
  const [analyzing, setAnalyzing] = useState(false);

  const take = async (source: "camera" | "library") => {
    const uri = await pickPhoto(source, "front");
    if (!uri) return;
    const name = persistPhoto(uri, "selfie");
    set({ selfiePhoto: name, photoTraits: undefined });
    setAnalyzing(true);
    try {
      set({ photoTraits: await analyzeSelfie(photoUri(name)) });
      router.push("/onboarding/quiz");
    } catch (e) {
      Alert.alert(
        "Couldn't analyze photo",
        "You can retake it or continue with the quiz only.",
      );
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <OnboardingStep
      step="selfie"
      title="Take a selfie"
      subtitle="We read your skin, hair and eye coloring. The quiz next fine-tunes it."
      primary={{
        label: selfie ? "Retake selfie" : "Take selfie",
        onPress: () => take("camera"),
        loading: analyzing,
      }}
      secondary={{
        label: "Skip photo, quiz only",
        onPress: () => router.push("/onboarding/quiz"),
      }}
    >
      {selfie ? (
        <Image
          source={photoUri(selfie)}
          style={{
            width: 160,
            height: 160,
            borderRadius: 80,
            alignSelf: "center",
          }}
          contentFit="cover"
        />
      ) : null}
      <Card>
        {TIPS.map((tip) => (
          <Text key={tip}>• {tip}</Text>
        ))}
      </Card>
      <View>
        <Button
          variant="ghost"
          label="Choose from library"
          onPress={() => take("library")}
          disabled={analyzing}
        />
      </View>
      {analyzing ? (
        <Text
          tone="muted"
          style={{ textAlign: "center", marginTop: t.space(2) }}
        >
          Analyzing your coloring…
        </Text>
      ) : null}
    </OnboardingStep>
  );
}
