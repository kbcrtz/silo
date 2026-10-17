import * as Haptics from "expo-haptics";
import { Pressable, View } from "react-native";
import { useTheme } from "@/theme";
import { Text } from "./Text";

type Option = { id: string; label: string; description?: string };

export function ChoiceList({
  options,
  selected,
  onSelect,
}: {
  options: Option[];
  selected?: string;
  onSelect: (id: string) => void;
}) {
  const t = useTheme();
  return (
    <View style={{ gap: t.space(3) }}>
      {options.map((option) => {
        const isSelected = option.id === selected;
        return (
          <Pressable
            key={option.id}
            accessibilityRole="radio"
            accessibilityState={{ selected: isSelected }}
            onPress={() => {
              Haptics.selectionAsync();
              onSelect(option.id);
            }}
            style={{
              padding: t.space(4),
              borderRadius: t.radius.md,
              borderWidth: isSelected ? 2 : 1,
              borderColor: isSelected ? t.colors.accent : t.colors.border,
              backgroundColor: t.colors.surface,
              gap: t.space(1),
            }}
          >
            <Text variant="heading">{option.label}</Text>
            {option.description ? (
              <Text tone="muted">{option.description}</Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}
