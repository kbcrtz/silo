import { router, useFocusEffect } from "expo-router";
import { useCallback, useRef } from "react";
import { Pressable, Text, useWindowDimensions, View } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { Backdrop } from "@/components/onboarding/Backdrop";
import { LogoTile } from "@/components/onboarding/Logo";
import { loadDemoProfile } from "@/data/demo";
import { TYPE } from "@/theme/brand";

/** How long the opening holds before moving on by itself. */
const HOLD_MS = 2200;

/**
 * The opening: the mark and wordmark over the gradient. It moves on to the
 * first step by itself, or sooner on a tap. A long press on the mark loads
 * the demo profile, for demos on a fresh install.
 */
export default function Opening() {
  const { height } = useWindowDimensions();
  const advanced = useRef(false);
  const next = useCallback(() => {
    if (advanced.current) return;
    advanced.current = true;
    router.push("/onboarding/essentials");
  }, []);

  // Only the first visit auto-advances; coming back here waits for a tap.
  useFocusEffect(
    useCallback(() => {
      if (advanced.current) {
        advanced.current = false;
        return;
      }
      const timer = setTimeout(next, HOLD_MS);
      return () => clearTimeout(timer);
    }, [next]),
  );

  return (
    <Pressable style={{ flex: 1 }} onPress={next} accessibilityLabel="Continue">
      <Backdrop id="neutral" />
      <View
        style={{
          position: "absolute",
          top: height * 0.366,
          left: 0,
          right: 0,
          alignItems: "center",
        }}
      >
        <Animated.View
          entering={FadeInDown.duration(700).springify().damping(16)}
        >
          <Pressable onLongPress={loadDemoProfile} delayLongPress={900}>
            <LogoTile />
          </Pressable>
        </Animated.View>
        <Animated.View entering={FadeIn.delay(350).duration(700)}>
          <Text style={[TYPE.wordmarkLarge, { marginTop: 16 }]}>Silo</Text>
        </Animated.View>
      </View>
    </Pressable>
  );
}
