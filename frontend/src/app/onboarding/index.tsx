import { Redirect, router, useFocusEffect } from "expo-router";
import { useCallback, useRef } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Backdrop } from "@/components/onboarding/Backdrop";
import { loadDemoProfile } from "@/data/demo";
import { useAccount } from "@/store/account";
import { useProfile } from "@/store/profile";
import { TYPE } from "@/theme/brand";

/** How long the opening holds before moving on by itself. */
const HOLD_MS = 2200;

/**
 * The opening: the wordmark, centered over the gradient. It moves on to the
 * first step by itself, or sooner on a tap. A long press on the wordmark loads
 * the demo profile, for demos on a fresh install.
 */
export default function Opening() {
  const onboarded = useProfile((s) => s.onboarded);
  const member = useAccount((s) => s.account.kind === "member");
  const advanced = useRef(false);
  const next = useCallback(() => {
    if (advanced.current || useProfile.getState().onboarded) return;
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

  // Onboarded without an account (from before sign-in was required): sign in.
  // Signed in, it's a lapsed membership: back to the plans.
  if (onboarded)
    return (
      <Redirect href={member ? "/onboarding/paywall" : "/onboarding/account"} />
    );

  return (
    <Pressable style={{ flex: 1 }} onPress={next} accessibilityLabel="Continue">
      <Backdrop id="neutral" />
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <Animated.View entering={FadeInDown.duration(600)}>
          <Pressable
            // Dev only: a fake profile in a real account would overwrite it on merge.
            onLongPress={__DEV__ ? loadDemoProfile : undefined}
            delayLongPress={900}
          >
            {/* The tight tracking pushes the S and o past the text box, so
                padding keeps them from being clipped. */}
            <Text style={[TYPE.wordmarkLarge, { paddingHorizontal: 16 }]}>
              Silo
            </Text>
          </Pressable>
        </Animated.View>
      </View>
    </Pressable>
  );
}
