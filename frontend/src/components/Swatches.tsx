import { View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useTheme } from "@/theme";

type Props = {
  colors: string[];
  size?: number;
  /** Staggered entrance, for the palette reveal. */
  animated?: boolean;
  crossed?: boolean;
};

export function Swatches({ colors, size = 36, animated, crossed }: Props) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: t.space(2) }}>
      {colors.map((color, i) => (
        <Animated.View
          key={`${color}-${i}`}
          entering={animated ? FadeInDown.delay(i * 60) : undefined}
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: color,
            borderWidth: 1,
            borderColor: "rgba(0,0,0,0.08)",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {crossed ? (
            <View
              style={{
                width: size * 0.9,
                height: 2,
                backgroundColor: t.colors.bg,
                transform: [{ rotate: "45deg" }],
              }}
            />
          ) : null}
        </Animated.View>
      ))}
    </View>
  );
}
