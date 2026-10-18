import {
  Canvas,
  Circle,
  RadialGradient,
  Shadow,
  vec,
} from "@shopify/react-native-skia";
import type { Metal } from "@/data/families";

/** Polished metal, lit from the upper left. */
const FINISH: Record<Metal, string[]> = {
  silver: ["#FFFFFF", "#E3E6EA", "#C3C8CF", "#A3AAB4"],
  gold: ["#F8EBB0", "#E7C873", "#CFA24A", "#B4842C"],
};

export function MetalOrb({
  metal,
  size = 55,
}: {
  metal: Metal;
  size?: number;
}) {
  const pad = 10;
  const r = size / 2;
  const c = r + pad;
  return (
    <Canvas
      style={{ width: size + pad * 2, height: size + pad * 2, margin: -pad }}
    >
      <Circle cx={c} cy={c} r={r} color="#FFFFFF">
        <Shadow dx={0} dy={3} blur={6} color="rgba(0,0,0,0.16)" />
      </Circle>
      <Circle cx={c} cy={c} r={r - 1.5}>
        <RadialGradient
          c={vec(c - r * 0.35, c - r * 0.4)}
          r={r * 1.5}
          colors={FINISH[metal]}
          positions={[0, 0.3, 0.65, 1]}
        />
      </Circle>
    </Canvas>
  );
}
