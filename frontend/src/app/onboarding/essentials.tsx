import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useRef, useState } from "react";
import { Text, View, type TextInput } from "react-native";
import { PrimaryButton } from "@/components/onboarding/Buttons";
import { Field, OptionButton } from "@/components/onboarding/Controls";
import { Header, stepBadge } from "@/components/onboarding/Header";
import { Headline } from "@/components/onboarding/Headline";
import { OnboardingScreen } from "@/components/onboarding/OnboardingScreen";
import { shopForGender, useProfile, type Gender } from "@/store/profile";
import { TYPE } from "@/theme/brand";

const GENDERS: { id: Gender; label: string }[] = [
  { id: "woman", label: "Woman" },
  { id: "man", label: "Man" },
  { id: "non-binary", label: "Non-binary" },
  { id: "unsaid", label: "Prefer not to say" },
];

function Label({ children }: { children: string }) {
  return <Text style={[TYPE.eyebrow, { marginBottom: 12 }]}>{children}</Text>;
}

/** Step one: name, age and gender. Gender picks the cuts the feed starts from. */
export default function Essentials() {
  const profile = useProfile();
  const [name, setName] = useState(profile.displayName ?? "");
  const [age, setAge] = useState(profile.age ? String(profile.age) : "");
  const [gender, setGender] = useState<Gender | undefined>(profile.gender);
  const nameRef = useRef<TextInput>(null);
  const ageRef = useRef<TextInput>(null);
  const ageNumber = parseInt(age, 10);

  // The button stays live, as in the design; it points at what's missing.
  const next = () => {
    if (!name.trim() || !gender) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      if (!name.trim()) nameRef.current?.focus();
      return;
    }
    profile.set({
      displayName: name.trim(),
      age: Number.isFinite(ageNumber) ? ageNumber : undefined,
      gender,
      shopFor: shopForGender(gender),
    });
    router.push("/onboarding/selfie");
  };

  return (
    <OnboardingScreen>
      <Header badge={stepBadge(1)} />
      <View style={{ marginTop: 136 }}>
        <Headline
          eyebrow="First, the essentials"
          title={"Tell us a little\nabout *you.*"}
        />
      </View>

      <View style={{ marginTop: 4 }}>
        <Label>YOUR NAME</Label>
        <Field
          ref={nameRef}
          value={name}
          onChangeText={setName}
          placeholder="What should we call you?"
          autoCapitalize="words"
          autoComplete="given-name"
          textContentType="givenName"
          returnKeyType="next"
          maxLength={24}
          onSubmitEditing={() => ageRef.current?.focus()}
        />
      </View>
      <View style={{ marginTop: 17 }}>
        <Label>AGE</Label>
        <Field
          ref={ageRef}
          value={age}
          onChangeText={(v) => setAge(v.replace(/[^0-9]/g, ""))}
          placeholder="Your age"
          keyboardType="number-pad"
          maxLength={3}
        />
      </View>
      <View style={{ marginTop: 17 }}>
        <Label>GENDER</Label>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 9 }}>
          {GENDERS.map((g) => (
            <OptionButton
              key={g.id}
              label={g.label}
              selected={gender === g.id}
              onPress={() => setGender(g.id)}
              style={{ width: "48.7%" }}
            />
          ))}
        </View>
      </View>

      <PrimaryButton
        label="Continue"
        onPress={next}
        style={{ marginTop: 29 }}
      />
    </OnboardingScreen>
  );
}
