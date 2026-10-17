import { Pressable } from "react-native";
import { useTheme } from "@/theme";
import { Text } from "./Text";

export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingVertical: t.space(2),
        paddingHorizontal: t.space(4),
        borderRadius: t.radius.pill,
        backgroundColor: selected ? t.colors.accent : t.colors.surface,
        borderWidth: 1,
        borderColor: selected ? t.colors.accent : t.colors.border,
      }}
    >
      <Text variant="caption" tone={selected ? "onAccent" : "default"}>
        {label}
      </Text>
    </Pressable>
  );
}
