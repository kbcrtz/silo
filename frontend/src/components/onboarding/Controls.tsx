import * as Haptics from "expo-haptics";
import { forwardRef } from "react";
import {
  Pressable,
  Text,
  TextInput,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import { BRAND, TYPE } from "@/theme/brand";
import { Glass } from "./Glass";

/** A text field: clear glass with the design's grey outline. */
export const Field = forwardRef<
  TextInput,
  TextInputProps & { height?: number }
>(function Field({ height = 48, style, ...props }, ref) {
  return (
    <Glass
      radius={20}
      variant="clear"
      fill={BRAND.glassTint}
      edge={BRAND.outline}
    >
      <TextInput
        ref={ref}
        placeholderTextColor={BRAND.placeholder}
        selectionColor={BRAND.ink}
        maxFontSizeMultiplier={1.3}
        style={[TYPE.control, { height, paddingHorizontal: 17 }, style]}
        {...props}
      />
    </Glass>
  );
});

/** One of a grid of outlined options, like gender. Selected turns ink. */
export function OptionButton({
  label,
  selected,
  onPress,
  style,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
      style={style}
    >
      <Glass
        radius={20}
        variant="clear"
        fill={selected ? BRAND.ink : BRAND.glassTint}
        edge={selected ? BRAND.ink : BRAND.outline}
        style={{ height: 48, alignItems: "center", justifyContent: "center" }}
      >
        <Text style={[TYPE.control, selected && { color: BRAND.white }]}>
          {label}
        </Text>
      </Glass>
    </Pressable>
  );
}

/** A frosted pill answer, as on the photo questions. */
export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
    >
      <Glass
        radius={22}
        fill={selected ? BRAND.ink : "rgba(255,255,255,0.42)"}
        edge={selected ? BRAND.ink : "rgba(255,255,255,0.75)"}
        interactive
        style={{ height: 44, paddingHorizontal: 15, justifyContent: "center" }}
      >
        <Text
          style={[
            TYPE.control,
            { color: selected ? BRAND.white : "rgba(23,19,17,0.78)" },
          ]}
        >
          {label}
        </Text>
      </Glass>
    </Pressable>
  );
}
