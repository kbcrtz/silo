import { Text as RNText, type TextProps } from "react-native";
import { useTheme, type Theme } from "@/theme";

type Props = TextProps & {
  variant?: keyof Theme["type"];
  tone?: "default" | "muted" | "accent" | "onAccent" | "danger";
};

export function Text({
  variant = "body",
  tone = "default",
  style,
  ...props
}: Props) {
  const t = useTheme();
  const color = {
    default: t.colors.text,
    muted: t.colors.textMuted,
    accent: t.colors.accentText,
    onAccent: t.colors.onAccent,
    danger: t.colors.danger,
  }[tone];
  // Capped so large Dynamic Type settings don't break fixed layouts.
  return (
    <RNText
      maxFontSizeMultiplier={1.4}
      style={[t.type[variant], { color }, style]}
      {...props}
    />
  );
}
