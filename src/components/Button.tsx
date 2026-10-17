import * as Haptics from "expo-haptics";
import { ActivityIndicator, Pressable, type ViewStyle } from "react-native";
import { useTheme } from "@/theme";
import { Text } from "./Text";

type Props = {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "ghost";
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
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
  const bg =
    variant === "primary"
      ? t.colors.accent
      : variant === "secondary"
        ? t.colors.surface
        : "transparent";
  const tone =
    variant === "primary"
      ? "onAccent"
      : variant === "ghost"
        ? "accent"
        : "default";
  return (
    <Pressable
      accessibilityRole="button"
      disabled={inactive}
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
      style={({ pressed }) => [
        {
          backgroundColor: bg,
          borderRadius: t.radius.pill,
          paddingVertical: t.space(4),
          paddingHorizontal: t.space(6),
          alignItems: "center",
          borderWidth: variant === "secondary" ? 1 : 0,
          borderColor: t.colors.border,
          opacity: inactive ? 0.5 : pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === "primary" ? t.colors.onAccent : t.colors.text}
        />
      ) : (
        <Text variant="heading" tone={tone}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}
