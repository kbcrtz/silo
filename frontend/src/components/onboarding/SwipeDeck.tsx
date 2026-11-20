import * as Haptics from "expo-haptics";
import { Image, type ImageSource } from "expo-image";
import { SymbolView, type SFSymbol } from "expo-symbols";
import { useImperativeHandle, useRef, type Ref } from "react";
import { Pressable, Text, View, useWindowDimensions } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  interpolate,
  runOnJS,
  type SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { AESTHETIC_INFO } from "@/data/aesthetics";
import type { DeckPhoto } from "@/lib/styleDeck";
import { BRAND, TYPE } from "@/theme/brand";
import { GUTTER } from "./OnboardingScreen";

type Card = DeckPhoto<ImageSource | number>;
type Fling = { fling: (liked: boolean) => void };

/** The photos are 5:7. */
const ASPECT = 7 / 5;
const RADIUS = 24;
/** The style step's header, headline, buttons and links around the card. */
const CHROME = 445;

/**
 * Outfit photos to swipe through: right for "I'd wear this", left to pass.
 * The buttons do the same for anyone who'd rather tap, and VoiceOver gets
 * both as actions on the card. The parent owns the position in the deck.
 */
export function SwipeDeck({
  cards,
  index,
  onSwipe,
}: {
  cards: Card[];
  index: number;
  onSwipe: (liked: boolean) => void;
}) {
  const screen = useWindowDimensions();
  // Sized so the headline above and the buttons below stay on screen.
  const height = Math.max(
    300,
    Math.min((screen.width - GUTTER * 2) * ASPECT, screen.height - CHROME),
  );
  const width = height / ASPECT;
  const top = useRef<Fling>(null);
  const current = cards[index];
  const next = cards[index + 1];

  return (
    <View style={{ alignItems: "center", gap: 16 }}>
      <View style={{ width, height }}>
        {next ? (
          // Peeks out from behind, ready to take the top card's place.
          <View
            key={`${next.dept}-${next.look}-${index + 1}`}
            style={{
              position: "absolute",
              inset: 0,
              transform: [{ scale: 0.95 }, { translateY: 14 }],
              opacity: 0.85,
            }}
          >
            <Photo card={next} width={width} height={height} />
          </View>
        ) : null}
        {current ? (
          <TopCard
            key={`${current.dept}-${current.look}-${index}`}
            ref={top}
            card={current}
            width={width}
            height={height}
            onSwipe={onSwipe}
          />
        ) : null}
      </View>

      <View style={{ flexDirection: "row", gap: 28, alignItems: "center" }}>
        <RoundButton
          symbol="xmark"
          label="Pass"
          onPress={() => top.current?.fling(false)}
        />
        <Text
          style={[TYPE.eyebrow, { minWidth: 64, textAlign: "center" }]}
          accessibilityLabel={`Look ${Math.min(index + 1, cards.length)} of ${cards.length}`}
        >
          {`${Math.min(index + 1, cards.length)} / ${cards.length}`}
        </Text>
        <RoundButton
          symbol="heart.fill"
          label="I'd wear this"
          ink
          onPress={() => top.current?.fling(true)}
        />
      </View>
    </View>
  );
}

function TopCard({
  ref,
  card,
  width,
  height,
  onSwipe,
}: {
  ref: Ref<Fling>;
  card: Card;
  width: number;
  height: number;
  onSwipe: (liked: boolean) => void;
}) {
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const gone = useSharedValue(false);
  const reduceMotion = useReducedMotion();
  const throwPast = width * 1.5;

  const done = (liked: boolean) => {
    Haptics.selectionAsync();
    onSwipe(liked);
  };

  const fling = (liked: boolean) => {
    "worklet";
    if (gone.value) return;
    gone.value = true;
    x.value = withTiming(
      liked ? throwPast : -throwPast,
      { duration: reduceMotion ? 120 : 260 },
      (finished) => {
        if (finished) runOnJS(done)(liked);
      },
    );
  };

  useImperativeHandle(ref, () => ({ fling }));

  // Horizontal drags move the card; vertical ones fail fast so the screen
  // still scrolls on a short phone.
  const pan = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .failOffsetY([-16, 16])
    .onChange((e) => {
      x.value = e.translationX;
      y.value = e.translationY * 0.3;
    })
    .onEnd((e) => {
      const far = Math.abs(x.value) > width * 0.3;
      const fast = Math.abs(e.velocityX) > 800;
      if (far || fast) {
        y.value = withTiming(0);
        fling(far ? x.value > 0 : e.velocityX > 0);
      } else {
        x.value = withSpring(0);
        y.value = withSpring(0);
      }
    });

  const moving = useAnimatedStyle(() => ({
    transform: [
      { translateX: x.value },
      { translateY: y.value },
      {
        rotate: `${reduceMotion ? 0 : interpolate(x.value, [-width, width], [-12, 12])}deg`,
      },
    ],
  }));

  const { label } = AESTHETIC_INFO[card.look];
  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        accessible
        accessibilityRole="image"
        accessibilityLabel={`${label} outfit`}
        accessibilityHint="Swipe right if you'd wear it, left to pass"
        accessibilityActions={[
          { name: "like", label: "I'd wear this" },
          { name: "pass", label: "Pass" },
        ]}
        onAccessibilityAction={(e) =>
          fling(e.nativeEvent.actionName === "like")
        }
        style={[{ position: "absolute", inset: 0 }, moving]}
      >
        <Photo card={card} width={width} height={height} />
        <Stamp text="YES" x={x} reach={width * 0.25} side="left" />
        <Stamp text="PASS" x={x} reach={-width * 0.25} side="right" />
      </Animated.View>
    </GestureDetector>
  );
}

/** The outfit, with its look named at the bottom. */
function Photo({
  card,
  width,
  height,
}: {
  card: Card;
  width: number;
  height: number;
}) {
  return (
    <View
      style={{
        width,
        height,
        borderRadius: RADIUS,
        overflow: "hidden",
        backgroundColor: BRAND.paper,
        borderWidth: 1,
        borderColor: BRAND.glassEdge,
        boxShadow: "0 10px 30px rgba(0,0,0,0.18)",
      }}
    >
      <Image source={card.image} style={{ flex: 1 }} contentFit="cover" />
      <View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          paddingHorizontal: 18,
          paddingTop: 48,
          paddingBottom: 16,
          experimental_backgroundImage:
            "linear-gradient(to bottom, rgba(23,19,17,0), rgba(23,19,17,0.6))",
        }}
      >
        <Text
          style={[TYPE.question, { color: BRAND.white }]}
          maxFontSizeMultiplier={1.3}
        >
          {AESTHETIC_INFO[card.look].label}
        </Text>
      </View>
    </View>
  );
}

/** Fades in as the card is dragged toward `reach` (negative for left). */
function Stamp({
  text,
  x,
  reach,
  side,
}: {
  text: string;
  x: SharedValue<number>;
  reach: number;
  side: "left" | "right";
}) {
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(x.value / reach, [0, 1], [0, 1], "clamp"),
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: "absolute",
          top: 22,
          [side]: 18,
          paddingHorizontal: 12,
          paddingVertical: 6,
          borderRadius: 10,
          borderWidth: 2,
          borderColor: BRAND.white,
          backgroundColor: "rgba(23,19,17,0.35)",
          transform: [{ rotate: side === "left" ? "-10deg" : "10deg" }],
        },
        style,
      ]}
    >
      <Text style={[TYPE.eyebrow, { color: BRAND.white, fontSize: 14 }]}>
        {text}
      </Text>
    </Animated.View>
  );
}

const BUTTON = 60;

function RoundButton({
  symbol,
  label,
  ink,
  onPress,
}: {
  symbol: SFSymbol;
  label: string;
  ink?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => ({
        width: BUTTON,
        height: BUTTON,
        borderRadius: BUTTON / 2,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: ink ? BRAND.ink : BRAND.glassFillStrong,
        borderWidth: 1,
        borderColor: ink ? BRAND.ink : BRAND.glassEdge,
        opacity: pressed ? 0.8 : 1,
        transform: [{ scale: pressed ? 0.94 : 1 }],
      })}
    >
      <SymbolView
        name={symbol}
        size={22}
        weight="semibold"
        tintColor={ink ? BRAND.white : BRAND.ink}
        style={{ width: 24, height: 24 }}
      />
    </Pressable>
  );
}
