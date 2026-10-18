import { Canvas, Circle, Group, Path, Skia } from "@shopify/react-native-skia";
import { BRAND } from "@/theme/brand";
import { Glass } from "./Glass";

/**
 * Silo's mark: a hanger inside a wardrobe arch. Drawn on a 100x120 grid as
 * one stroked path, so it stays crisp at any size.
 */
const MARK = Skia.Path.MakeFromSVGString(
  [
    // The arch, open at the bottom.
    "M3 118 L3 26 Q3 3 26 3 L74 3 Q97 3 97 26 L97 118",
    // The rail down the middle.
    "M49 3 L49 106",
    // The hanger's hook, curling off the rail.
    "M49 11 C61 11 63 25 53 29 C50 30 49 32 49 34",
    // The hanger.
    "M49 34 L21 58 L79 57 Z",
    // The floor.
    "M25 108 L81 106",
  ].join(" "),
)!;

export function Mark({ width }: { width: number }) {
  const k = width / 100;
  const height = width * 1.2;
  return (
    <Canvas style={{ width: width + 6, height: height + 6 }}>
      <Group transform={[{ translateX: 3 }, { translateY: 3 }, { scale: k }]}>
        <Path
          path={MARK}
          style="stroke"
          strokeWidth={4.3}
          strokeCap="round"
          strokeJoin="round"
          color={BRAND.ink}
        />
        <Circle cx={37} cy={77} r={3.4} color={BRAND.ink} />
        <Circle cx={66} cy={75} r={3.4} color={BRAND.ink} />
      </Group>
    </Canvas>
  );
}

/** The app-icon tile from the opening screen: the mark on tilted glass. */
export function LogoTile({ size = 133 }: { size?: number }) {
  return (
    <Glass
      radius={size * 0.23}
      fill="rgba(255,255,255,0.82)"
      edge="rgba(255,255,255,0.95)"
      style={{
        width: size,
        height: size,
        alignItems: "center",
        justifyContent: "center",
        transform: [{ rotate: "-2.5deg" }],
        overflow: "visible",
        shadowColor: BRAND.shadow,
        shadowOpacity: 0.1,
        shadowRadius: 22,
        shadowOffset: { width: 0, height: 14 },
      }}
    >
      <Mark width={size * 0.42} />
    </Glass>
  );
}
