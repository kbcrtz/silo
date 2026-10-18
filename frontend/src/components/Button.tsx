import * as Haptics from "expo-haptics";
import {
  ActivityIndicator,
  Pressable,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useTheme } from "@/theme";
import { BRAND } from "@/theme/brand";
import { GlassPill, GradientPill } from "./GlassPill";
import { Text } from "./Text";

const HEIGHT = 52;

type Props = {
  label: string;
  onPress: () => void;
  /** Primary is glass over the season gradient, secondary plain glass. */
  variant?: "primary" | "secondary" | "ghost";
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Button({
  label,
  onPress,
  variant = "primary",
  disabled,
  loading,
  style,
}: Props) {
  const t = useTheme();
  const inactive = disabled || loading;
  const content = loading ? (
    <ActivityIndicator color={BRAND.ink} />
  ) : (
    <Text variant="heading" tone={variant === "ghost" ? "accent" : "default"}>
      {label}
    </Text>
  );
  const padding = { paddingHorizontal: t.space(6) };
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      disabled={inactive}
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
      style={({ pressed }) => [
        {
          opacity: inactive ? 0.5 : pressed ? 0.88 : 1,
          transform: [{ scale: pressed && variant !== "ghost" ? 0.985 : 1 }],
        },
        style,
      ]}
    >
      {variant === "primary" ? (
        <GradientPill height={HEIGHT} style={padding}>
          {content}
        </GradientPill>
      ) : variant === "secondary" ? (
        <GlassPill height={HEIGHT} interactive style={padding}>
          {content}
        </GlassPill>
      ) : (
        <View
          style={{
            height: HEIGHT,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {content}
        </View>
      )}
    </Pressable>
  );
}
