import { Image, type ImageSource } from "expo-image";
import { useEffect, useState, type ReactNode } from "react";
import { ActivityIndicator, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useTheme } from "@/theme";
import { Text } from "./Text";

/**
 * The backend's AI try-on image: the item alone on a bare mannequin. The
 * first view of a product waits a few seconds while it's generated (saved
 * after that), showing the drawn mannequin faded under a progress bar; if it
 * fails, the drawn mannequin (the fallback) shows instead.
 */
export function AiTryOn({
  source,
  fallback,
}: {
  source: ImageSource;
  fallback: ReactNode;
}) {
  const t = useTheme();
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  const [slow, setSlow] = useState(false);
  const progress = useSharedValue(0);
  const bar = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));

  useEffect(() => {
    // Saved images arrive in ~50 ms; only a new one (6-9 s) shows the wait.
    const timer = setTimeout(() => {
      setSlow(true);
      // Timed, not real progress: the backend sends nothing until the image is done.
      progress.value = withTiming(0.9, {
        duration: 8000,
        easing: Easing.out(Easing.quad),
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [progress]);

  if (state === "failed") return <>{fallback}</>;
  return (
    // alignSelf: the try-on box centers its children, which would leave this view (and the image) zero wide.
    <View style={{ flex: 1, alignSelf: "stretch" }}>
      <Image
        source={source}
        style={{ flex: 1, borderRadius: t.radius.md }}
        contentFit="contain"
        transition={250}
        accessibilityLabel="AI preview of the item on a mannequin"
        onLoad={() => {
          if (!slow) return setState("ready");
          progress.value = withTiming(1, { duration: 200 });
          setTimeout(() => setState("ready"), 200);
        }}
        onError={() => setState("failed")}
      />
      {state === "loading" && slow ? (
        <View style={{ position: "absolute", inset: 0, alignItems: "center" }}>
          <View style={{ opacity: 0.3 }}>{fallback}</View>
          <View
            style={{
              position: "absolute",
              inset: 0,
              alignItems: "center",
              justifyContent: "center",
              gap: t.space(2),
            }}
          >
            <ActivityIndicator color={t.colors.textMuted} />
            <Text variant="caption" tone="muted">
              Creating your try-on preview…
            </Text>
            <View
              accessibilityRole="progressbar"
              style={{
                width: t.space(40),
                height: 4,
                borderRadius: t.radius.pill,
                backgroundColor: t.colors.border,
                overflow: "hidden",
              }}
            >
              <Animated.View
                style={[{ height: "100%", backgroundColor: t.colors.accent }, bar]}
              />
            </View>
          </View>
        </View>
      ) : null}
    </View>
  );
}
