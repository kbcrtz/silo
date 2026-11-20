import { router } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import type { FashionStyle } from "@/api/catalog";
import { PrimaryButton } from "@/components/onboarding/Buttons";
import { Header } from "@/components/onboarding/Header";
import { Headline } from "@/components/onboarding/Headline";
import { OnboardingScreen } from "@/components/onboarding/OnboardingScreen";
import { SwipeDeck } from "@/components/onboarding/SwipeDeck";
import { StylePicker } from "@/components/StylePicker";
import type { Aesthetic } from "@/data/aesthetics";
import { DECK_PHOTOS } from "@/data/deck";
import { familyOf } from "@/data/families";
import { buildDeck, readSwipes, type Swipe } from "@/lib/styleDeck";
import { useProfile } from "@/store/profile";
import { BRAND, TYPE } from "@/theme/brand";

/**
 * After the color results: a deck of outfit photos to swipe, then the looks
 * they point to as cards to adjust, and how they wear color. It steers the
 * feed's searches; Skip leaves the feed plain. "Redo onboarding" starts the
 * cards from what they picked last time.
 */
export default function StyleStep() {
  const profile = useProfile();
  const stated = profile.taste?.stated;
  const [deck, setDeck] = useState(() =>
    buildDeck(DECK_PHOTOS, profile.shopFor),
  );
  const [swipes, setSwipes] = useState<Swipe[]>([]);
  const [phase, setPhase] = useState<"deck" | "pick">(
    deck.length ? "deck" : "pick",
  );
  const [liked, setLiked] = useState<Aesthetic[]>(stated?.liked ?? []);
  const [rejected, setRejected] = useState<Aesthetic[]>(stated?.rejected ?? []);
  const [colorStyle, setColorStyle] = useState<FashionStyle>(
    stated?.colorStyle ?? "none",
  );
  const seasonId = profile.colorProfile?.seasonId;
  const next = () => router.push("/onboarding/body-profile");

  const swipe = (yes: boolean) => {
    const card = deck[swipes.length];
    if (!card) return;
    const all = [...swipes, { look: card.look, liked: yes }];
    setSwipes(all);
    if (all.length === deck.length) {
      const read = readSwipes(all);
      setLiked(read.liked);
      setRejected(read.rejected);
      setPhase("pick");
    }
  };

  const swipeAgain = () => {
    setDeck(buildDeck(DECK_PHOTOS, profile.shopFor));
    setSwipes([]);
    setPhase("deck");
  };

  const save = () => {
    profile.set({
      taste: {
        ...profile.taste,
        stated: {
          liked,
          // A look picked on the cards isn't turned down, whatever the swipes said.
          rejected: rejected.filter((a) => !liked.includes(a)),
          colorStyle,
          via: "onboarding",
          at: new Date().toISOString(),
        },
      },
    });
    next();
  };

  const swiped = phase === "pick" && swipes.length > 0;

  return (
    <OnboardingScreen backdrop={seasonId ? familyOf(seasonId) : "neutral"}>
      <Header badge="YOUR STYLE" />
      <View style={{ marginTop: 26 }}>
        <Headline
          size="medium"
          eyebrow={swiped ? "Your looks" : "Now, your taste"}
          title={
            phase === "deck"
              ? "Would you\n*wear this?*"
              : swiped && liked.length
                ? "Here's what\n*you reach for*"
                : "What do you\n*reach for?*"
          }
        />
      </View>
      <Text
        style={[
          TYPE.bodySmall,
          { color: BRAND.inkSoft, marginTop: 16, marginBottom: 24 },
        ]}
      >
        {phase === "deck"
          ? "Swipe right on outfits you'd wear, left on ones you wouldn't. Your feed looks for what you like, in your colors."
          : swiped
            ? liked.length
              ? "From your swipes. Change them if we got it wrong; you can edit them any time in your profile."
              : "Nothing stood out, so pick up to three below, or skip and your feed stays broad."
            : "Your feed searches for these looks in your colors. You can change them any time in your profile."}
      </Text>

      {phase === "deck" ? (
        <>
          <SwipeDeck cards={deck} index={swipes.length} onSwipe={swipe} />
          <View
            style={{
              flexDirection: "row",
              justifyContent: "center",
              flexWrap: "wrap",
              columnGap: 18,
              marginTop: 10,
            }}
          >
            {swipes.length ? (
              <TextButton
                label="Undo"
                onPress={() => setSwipes((s) => s.slice(0, -1))}
              />
            ) : null}
            <TextButton
              label="Pick from a list"
              onPress={() => setPhase("pick")}
            />
            <TextButton label="Skip" onPress={next} />
          </View>
        </>
      ) : (
        <>
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
          {deck.length ? (
            <TextButton
              label={swipes.length ? "Swipe again" : "Back to the photos"}
              onPress={swipes.length ? swipeAgain : () => setPhase("deck")}
              style={{ marginTop: 16 }}
            />
          ) : null}
        </>
      )}
      {phase === "pick" ? (
        <TextButton label="Skip for now" onPress={next} />
      ) : null}
    </OnboardingScreen>
  );
}

function TextButton({
  label,
  onPress,
  style,
}: {
  label: string;
  onPress: () => void;
  style?: { marginTop?: number };
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      hitSlop={8}
      style={{ alignSelf: "center", padding: 8, ...style }}
    >
      <Text style={[TYPE.control, { color: BRAND.inkSoft }]}>{label}</Text>
    </Pressable>
  );
}
