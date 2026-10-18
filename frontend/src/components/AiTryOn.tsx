import { Image, type ImageSource } from "expo-image";
import { useState, type ReactNode } from "react";
import { ActivityIndicator, View } from "react-native";
import { useTheme } from "@/theme";
import { Text } from "./Text";

/**
 * The backend's AI try-on image: the item alone on a bare mannequin. The
 * first view of a product waits a few seconds while it's generated (saved
 * after that); if it fails, the fallback (the drawn mannequin) shows instead.
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
        onLoad={() => setState("ready")}
        onError={() => setState("failed")}
      />
      {state === "loading" ? (
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
        </View>
      ) : null}
    </View>
  );
}
