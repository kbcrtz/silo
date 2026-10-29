import * as Haptics from "expo-haptics";
import { Pressable } from "react-native";
import { BRAND } from "@/theme/brand";
import { GlassPill } from "./GlassPill";
import { Text } from "./Text";

/** A glass choice pill; selected turns ink. */
export function Chip({
  label,
  selected,
  onPress,
  height = 36,
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
  height?: number;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
    >
      <GlassPill
        height={height}
        fill={selected ? BRAND.ink : undefined}
        solid={selected}
        interactive
        style={{ paddingHorizontal: 15 }}
      >
        <Text variant="caption" style={selected && { color: BRAND.white }}>
          {label}
        </Text>
      </GlassPill>
    </Pressable>
  );
}
