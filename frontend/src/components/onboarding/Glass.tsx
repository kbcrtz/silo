import {
  GlassView,
  isGlassEffectAPIAvailable,
  isLiquidGlassAvailable,
  type GlassStyle,
} from "expo-glass-effect";
import type { ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { BRAND } from "@/theme/brand";

/** iOS 26 liquid glass; older iOS gets a frosted look-alike. */
export const LIQUID_GLASS =
  isLiquidGlassAvailable() && isGlassEffectAPIAvailable();

type Props = {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  radius: number;
  /** "clear" lets the gradient through; "regular" frosts it. */
  variant?: GlassStyle;
  /** Fill for the frosted fallback, and the tint on liquid glass. */
  fill?: string;
  /** The hairline around the edge, as in the design. */
  edge?: string;
  interactive?: boolean;
};

/**
 * A glass surface. Both paths draw the design's hairline edge on top, so a
 * card reads the same on every iOS version.
 */
export function Glass({
  children,
  style,
  radius,
  variant = "regular",
  fill = BRAND.glassFill,
  edge = BRAND.glassEdge,
  interactive,
}: Props) {
  const outline = (
    <View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        { borderRadius: radius, borderWidth: 1, borderColor: edge },
      ]}
    />
  );
  if (LIQUID_GLASS) {
    return (
      <GlassView
        glassEffectStyle={variant}
        tintColor={fill}
        colorScheme="light"
        isInteractive={interactive}
        style={[{ borderRadius: radius, overflow: "hidden" }, style]}
      >
        {children}
        {outline}
      </GlassView>
    );
  }
  return (
    <View
      style={[
        { borderRadius: radius, backgroundColor: fill, overflow: "hidden" },
        style,
      ]}
    >
      {children}
      {outline}
    </View>
  );
}
