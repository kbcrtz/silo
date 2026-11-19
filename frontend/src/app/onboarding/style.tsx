import { router } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import type { FashionStyle } from "@/api/catalog";
import { PrimaryButton } from "@/components/onboarding/Buttons";
import { Header } from "@/components/onboarding/Header";
import { Headline } from "@/components/onboarding/Headline";
import { OnboardingScreen } from "@/components/onboarding/OnboardingScreen";
import { StylePicker } from "@/components/StylePicker";
import type { Aesthetic } from "@/data/aesthetics";
import { familyOf } from "@/data/families";
import { useProfile } from "@/store/profile";
import { BRAND, TYPE } from "@/theme/brand";

/**
 * After the color results: which looks they'd wear and how they wear color.
 * It steers the feed's searches; Skip leaves the feed plain. "Redo
 * onboarding" starts from what they picked last time.
 */
export default function StyleStep() {
  const profile = useProfile();
  const stated = profile.taste?.stated;
  const [liked, setLiked] = useState<Aesthetic[]>(stated?.liked ?? []);
  const [colorStyle, setColorStyle] = useState<FashionStyle>(
    stated?.colorStyle ?? "none",
  );
  const seasonId = profile.colorProfile?.seasonId;
  const next = () => router.push("/onboarding/body-profile");

  const save = () => {
    profile.set({
      taste: {
        ...profile.taste,
        stated: {
          liked,
          rejected: stated?.rejected ?? [],
          colorStyle,
          via: "onboarding",
          at: new Date().toISOString(),
        },
      },
    });
    next();
  };

  return (
    <OnboardingScreen backdrop={seasonId ? familyOf(seasonId) : "neutral"}>
      <Header badge="YOUR STYLE" />
      <View style={{ marginTop: 26 }}>
        <Headline
          size="medium"
          eyebrow="Now, your taste"
          title={"What do you\n*reach for?*"}
        />
      </View>
      <Text style={[TYPE.bodySmall, { color: BRAND.inkSoft, marginTop: 16, marginBottom: 24 }]}>
        Your feed searches for these looks in your colors. You can change
        them any time in your profile.
      </Text>

      <StylePicker
        shopFor={profile.shopFor}
        liked={liked}
        onLikedChange={setLiked}
        colorStyle={colorStyle}
        onColorStyleChange={setColorStyle}
      />

      <PrimaryButton
        label="Continue"
        onPress={save}
        style={{ marginTop: 28 }}
      />
      <Pressable
        accessibilityRole="button"
        onPress={next}
        hitSlop={8}
        style={{ alignSelf: "center", marginTop: 16, padding: 8 }}
      >
        <Text style={[TYPE.control, { color: BRAND.inkSoft }]}>
          Skip for now
        </Text>
      </Pressable>
    </OnboardingScreen>
  );
}
