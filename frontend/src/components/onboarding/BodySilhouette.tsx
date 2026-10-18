import {
  Canvas,
  DashPathEffect,
  Group,
  Path,
  Skia,
  usePathInterpolation,
  type SkPath,
} from "@shopify/react-native-skia";
import { useEffect, useMemo, useState } from "react";
import { useSharedValue, withTiming } from "react-native-reanimated";
import { bodyOutlines, landmarks } from "@/lib/mannequin";
import type { Measurements } from "@/lib/measurements";
import type { ShopFor } from "@/store/profile";
import { BRAND } from "@/theme/brand";
import { smooth } from "../skia/smooth";

/**
 * The figure on the body profile: the user's proportions as a solid shape,
 * with dashed guides at the waist, hips and where the legs start. It eases between shapes as the
 * measurements change, so typing a number visibly reshapes it.
 */
export function BodySilhouette({
  measurements,
  shopFor,
  height,
}: {
  measurements: Measurements;
  shopFor: ShopFor;
  height: number;
}) {
  const width = height * 0.5;
  const shape = useMemo(() => {
    const L = landmarks(measurements, shopFor);
    // Drawn against a 2 m frame rather than filled, so taller users look taller.
    const scale = height / 200;
    const body = bodyOutlines(L);
    const path = smooth(body.silhouette, scale, true);
    const headR = 0.052 * L.H * scale;
    path.addCircle(0, (L.y.chin / 2) * scale + 1, headR);
    const guide = (y: number) => {
      const half = L.halfAt(y) - 1.6;
      const p = Skia.Path.Make();
      p.moveTo(-half * scale, y * scale);
      p.lineTo(half * scale, y * scale);
      return p;
    };
    return {
      path,
      waist: guide(L.y.waist),
      hip: guide(L.y.hip),
      // Where the legs start, so a leg-length change is visible.
      legs: guide(L.y.crotch),
      offset: height - L.H * scale,
    };
  }, [measurements, shopFor, height]);

  const [pair, setPair] = useState<{ from: SkPath; to: SkPath }>(() => ({
    from: shape.path,
    to: shape.path,
  }));
  const progress = useSharedValue(1);
  useEffect(() => {
    setPair((p) => (p.to === shape.path ? p : { from: p.to, to: shape.path }));
    progress.value = 0;
    progress.value = withTiming(1, { duration: 380 });
  }, [shape.path, progress]);
  const path = usePathInterpolation(progress, [0, 1], [pair.from, pair.to]);

  return (
    <Canvas style={{ width, height }}>
      <Group
        transform={[{ translateX: width / 2 }, { translateY: shape.offset }]}
      >
        <Path path={path} color={BRAND.ink} />
        {[shape.waist, shape.hip, shape.legs].map((g, i) => (
          <Path
            key={i}
            path={g}
            style="stroke"
            strokeWidth={0.8}
            color="rgba(255,255,255,0.75)"
          >
            <DashPathEffect intervals={[3, 2.5]} />
          </Path>
        ))}
      </Group>
    </Canvas>
  );
}
