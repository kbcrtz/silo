import { Image } from "expo-image";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { OnboardingStep } from "@/components/OnboardingStep";
import { Text } from "@/components/Text";
import { persistPhoto, photoUri } from "@/lib/photos";
import { pickPhoto } from "@/lib/pickPhoto";
import { useProfile } from "@/store/profile";
import { useTheme } from "@/theme";

const TIPS = [
  "Full length, head to feet",
  "Fitted clothes, standing straight",
  "Plain background, good light",
];

export default function BodyPhotoStep() {
  const t = useTheme();
  const bodyPhoto = useProfile((s) => s.bodyPhoto);
  const set = useProfile((s) => s.set);

  const add = async (source: "camera" | "library") => {
    const uri = await pickPhoto(source);
    if (uri) set({ bodyPhoto: persistPhoto(uri, "body") });
  };

  // Setting onboarded swaps the root stack's protected groups; the router
  // moves to the tabs on its own.
  const finish = () => set({ onboarded: true });

  return (
    <OnboardingStep
      step="body-photo"
      title="Photo for try-on"
      subtitle="Silo dresses this photo in the clothes you pick."
      primary={
        bodyPhoto
          ? { label: "Finish", onPress: finish }
          : { label: "Take photo", onPress: () => add("camera") }
      }
      secondary={
        bodyPhoto
          ? { label: "Retake", onPress: () => add("camera") }
          : { label: "Skip for now", onPress: finish }
      }
    >
      {bodyPhoto ? (
        <Image
          source={photoUri(bodyPhoto)}
          style={{
            width: 180,
            height: 240,
            borderRadius: t.radius.lg,
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
      <Button
        variant="ghost"
        label="Choose from library"
        onPress={() => add("library")}
      />
    </OnboardingStep>
  );
}
