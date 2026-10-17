import type { ReactNode } from "react";
import { View, type ViewStyle } from "react-native";
import { useTheme } from "@/theme";

export function Card({
  children,
  style,
}: {
  children: ReactNode;
  style?: ViewStyle;
}) {
  const t = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: t.colors.surface,
          borderRadius: t.radius.lg,
          borderWidth: 1,
          borderColor: t.colors.border,
          padding: t.space(4),
          gap: t.space(2),
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
