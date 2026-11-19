import { router } from "expo-router";
import { useState } from "react";
import type { FashionStyle } from "@/api/catalog";
import { GlassScreen } from "@/components/GlassScreen";
import { PrimaryButton } from "@/components/onboarding/Buttons";
import { StylePicker } from "@/components/StylePicker";
import type { Aesthetic } from "@/data/aesthetics";
import { useProfile } from "@/store/profile";

/** Profile › Your style, and the feed's "Tell us your style" card: the same picker as onboarding. */
export default function StyleScreen() {
  const profile = useProfile();
  const stated = profile.taste?.stated;
  const [liked, setLiked] = useState<Aesthetic[]>(stated?.liked ?? []);
  const [colorStyle, setColorStyle] = useState<FashionStyle>(
    stated?.colorStyle ?? "none",
  );

  const save = () => {
    profile.set({
      taste: {
        ...profile.taste,
        stated: {
          liked,
          rejected: stated?.rejected ?? [],
          colorStyle,
          via: "profile",
          at: new Date().toISOString(),
        },
      },
    });
    router.back();
  };

  return (
    <GlassScreen
      badge="YOUR STYLE"
      eyebrow="Your feed searches for these"
      title={"Your\n*style.*"}
      footer={<PrimaryButton label="Save" arrow={false} onPress={save} />}
    >
      <StylePicker
        shopFor={profile.shopFor}
        liked={liked}
        onLikedChange={setLiked}
        colorStyle={colorStyle}
        onColorStyleChange={setColorStyle}
      />
    </GlassScreen>
  );
}
