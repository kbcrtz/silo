import * as Haptics from "expo-haptics";
import { SymbolView } from "expo-symbols";
import {
  ActivityIndicator,
  Pressable,
  Text,
  type ViewStyle,
} from "react-native";
import { BRAND, TYPE } from "@/theme/brand";
import { Glass } from "./Glass";

const HEIGHT = 57;
const RADIUS = 26;

/** The black call to action: label on the left, an arrow on the right. */
export function PrimaryButton({
  label,
  onPress,
  disabled,
  loading,
  arrow = true,
  style,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  arrow?: boolean;
  style?: ViewStyle;
}) {
  const off = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled, busy: !!loading }}
      disabled={off}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      style={({ pressed }) => [
        {
          height: HEIGHT,
          borderRadius: RADIUS,
          paddingHorizontal: 23,
          flexDirection: "row",
          alignItems: "center",
          // A lone label sits centered; with an arrow it leads.
          justifyContent: arrow || loading ? "space-between" : "center",
          backgroundColor: disabled ? BRAND.disabled : BRAND.ink,
          opacity: pressed ? 0.88 : 1,
          transform: [{ scale: pressed ? 0.985 : 1 }],
        },
        !disabled && {
          shadowColor: BRAND.shadow,
          shadowOpacity: 0.22,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 12 },
        },
        style,
      ]}
    >
      <Text
        maxFontSizeMultiplier={1.3}
        style={[
          TYPE.button,
          { color: disabled ? BRAND.onDisabled : BRAND.white },
        ]}
      >
        {label}
      </Text>
      {loading ? (
        <ActivityIndicator color={BRAND.white} />
      ) : arrow ? (
        <SymbolView
          name="arrow.right"
          size={18}
          weight="regular"
          tintColor={disabled ? BRAND.onDisabled : BRAND.white}
          style={{ width: 20, height: 20 }}
        />
      ) : null}
    </Pressable>
  );
}

/** The quieter glass button beside a primary one. */
export function GlassButton({
  label,
  onPress,
  style,
}: {
  label: string;
  onPress: () => void;
  style?: ViewStyle;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }, style]}
    >
      <Glass
        radius={RADIUS}
        fill={BRAND.glassFillStrong}
        interactive
        style={{
          height: HEIGHT,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 20,
        }}
      >
        <Text maxFontSizeMultiplier={1.3} style={TYPE.control}>
          {label}
        </Text>
      </Glass>
    </Pressable>
  );
}
