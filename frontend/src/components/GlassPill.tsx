import type { ReactNode } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { BackdropFill, useSeasonBackdrop } from "./onboarding/Backdrop";
import { Glass } from "./onboarding/Glass";
import { BRAND } from "@/theme/brand";

// Glass on a light page: a bright tint, a faint edge and a soft shadow lift
// it off the page the way it would over a photo.
export const PILL_FILL = "rgba(255,255,255,0.55)";
export const PILL_EDGE = "rgba(23,19,17,0.08)";
/** How much of the season backdrop, from the top, a gradient pill shows. */
const GRADIENT_SPAN = 360;

const lift = (height: number, opacity: number) =>
  ({
    borderRadius: height / 2,
    backgroundColor: BRAND.white,
    shadowColor: BRAND.shadow,
    shadowOpacity: opacity,
    shadowRadius: height / 4,
    shadowOffset: { width: 0, height: height / 10 },
  }) satisfies ViewStyle;

/** A liquid glass capsule; every pill-shaped control in the app is one. */
export function GlassPill({
  height,
  fill = PILL_FILL,
  shadow = true,
  interactive,
  style,
  children,
}: {
  height: number;
  fill?: string;
  /** Off for pills that sit over a photo, where a shadow would muddy it. */
  shadow?: boolean;
  interactive?: boolean;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const pill = (
    <Glass
      radius={height / 2}
      fill={fill}
      edge={PILL_EDGE}
      interactive={interactive}
      style={[
        {
          height,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
        },
        style,
      ]}
    >
      {children}
    </Glass>
  );
  return shadow ? <View style={lift(height, 0.1)}>{pill}</View> : pill;
}

/**
 * The main call to action: clear liquid glass over the top of the season
 * gradient, so the color shows through the lens.
 */
export function GradientPill({
  height,
  style,
  children,
}: {
  height: number;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const backdrop = useSeasonBackdrop();
  return (
    <View style={lift(height, 0.16)}>
      <View style={{ height, borderRadius: height / 2, overflow: "hidden" }}>
        <BackdropFill id={backdrop} span={GRADIENT_SPAN} />
        <Glass
          radius={height / 2}
          variant="clear"
          fill="rgba(255,255,255,0.12)"
          edge="rgba(255,255,255,0.7)"
          interactive
          style={[
            {
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
            },
            style,
          ]}
        >
          {children}
        </Glass>
      </View>
    </View>
  );
}
