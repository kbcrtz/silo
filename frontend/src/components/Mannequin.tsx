import {
  BlurMask,
  Canvas,
  Circle,
  Group,
  LinearGradient,
  Oval,
  Path,
  Skia,
  vec,
  type SkPath,
} from "@shopify/react-native-skia";
import { useMemo } from "react";
import type { CatalogItem } from "@/data/catalog";
import { mix } from "@/lib/color";
import {
  bodyOutlines,
  garmentOutlines,
  landmarks,
  type Pt,
} from "@/lib/mannequin";
import type { Measurements } from "@/lib/measurements";
import type { ShopFor } from "@/store/profile";
import { useTheme } from "@/theme";

/**
 * Catmull-Rom through the points, as cubic beziers. A `sharp` point gets a
 * zero-length tangent, which turns it into a corner.
 */
function smooth(points: Pt[], scale: number, closed: boolean): SkPath {
  const path = Skia.Path.Make();
  const n = points.length;
  const at = (i: number) => points[closed ? (i + n) % n : clampIndex(i, n)];
  path.moveTo(points[0].x * scale, points[0].y * scale);
  const segments = closed ? n : n - 1;
  for (let i = 0; i < segments; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    const c1 = p1.sharp
      ? p1
      : { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = p2.sharp
      ? p2
      : { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    path.cubicTo(
      c1.x * scale,
      c1.y * scale,
      c2.x * scale,
      c2.y * scale,
      p2.x * scale,
      p2.y * scale,
    );
  }
  if (closed) path.close();
  return path;
}

const clampIndex = (i: number, n: number) => Math.min(n - 1, Math.max(0, i));

/**
 * A front-view mannequin built from the user's measurements, wearing the
 * item in its cut and color. With no item it is just the figure.
 */
export function Mannequin({
  measurements,
  shopFor,
  item,
  height,
}: {
  measurements: Measurements;
  shopFor: ShopFor;
  item?: CatalogItem;
  height: number;
}) {
  const t = useTheme();
  const L = useMemo(
    () => landmarks(measurements, shopFor),
    [measurements, shopFor],
  );
  const body = useMemo(() => bodyOutlines(L), [L]);
  const garment = useMemo(
    () => (item ? garmentOutlines(L, item) : null),
    [L, item],
  );

  // A little headroom above and floor below for the shadow.
  const scale = (height * 0.92) / L.H;
  const width = height * 0.5;
  const halfSpan = (width / 2) * 0.98;

  const paths = useMemo(
    () => ({
      body: body.parts.map((o) => smooth(o, scale, true)),
      garment: garment?.parts.map((o) => smooth(o, scale, true)) ?? [],
      lines: garment?.lines.map((l) => smooth(l, scale, false)) ?? [],
    }),
    [body, garment, scale],
  );

  const skinLight = mix(t.colors.surface, t.colors.border, 0.55);
  const skinDark = mix(t.colors.border, t.colors.textMuted, 0.55);
  const fabric = item?.colors[0] ?? t.colors.accent;
  const fabricLight = mix(fabric, "#FFFFFF", 0.2);
  const fabricDark = mix(fabric, "#000000", 0.28);
  const seam = mix(fabric, "#000000", 0.45);
  const button = item?.colors[1] ?? mix(fabric, "#000000", 0.55);

  const shade = (light: string, dark: string) => (
    <LinearGradient
      start={vec(-halfSpan, 0)}
      end={vec(halfSpan, 0)}
      colors={[dark, light, light, dark]}
      positions={[0, 0.38, 0.55, 1]}
    />
  );

  return (
    <Canvas style={{ width, height }}>
      <Group
        transform={[{ translateX: width / 2 }, { translateY: height * 0.03 }]}
      >
        <Oval
          x={-width * 0.22}
          y={L.H * scale - height * 0.012}
          width={width * 0.44}
          height={height * 0.035}
          color={t.colors.text}
          opacity={0.14}
        >
          <BlurMask blur={6} style="normal" />
        </Oval>

        {paths.body.map((p, i) => (
          <Path key={`b${i}`} path={p}>
            {shade(skinLight, skinDark)}
          </Path>
        ))}
        {body.feet.map((f, i) => (
          <Oval
            key={`f${i}`}
            x={(f.cx - f.rx) * scale}
            y={(f.cy - f.ry) * scale}
            width={f.rx * 2 * scale}
            height={f.ry * 2 * scale}
            color={skinDark}
          />
        ))}
        <Oval
          x={(body.head.cx - body.head.rx) * scale}
          y={(body.head.cy - body.head.ry) * scale}
          width={body.head.rx * 2 * scale}
          height={body.head.ry * 2 * scale}
        >
          {shade(skinLight, skinDark)}
        </Oval>

        {paths.garment.map((p, i) => (
          <Group key={`g${i}`}>
            <Path path={p}>{shade(fabricLight, fabricDark)}</Path>
            <Path
              path={p}
              style="stroke"
              strokeWidth={1}
              color={seam}
              opacity={0.6}
            />
          </Group>
        ))}
        {paths.lines.map((p, i) => (
          <Path
            key={`l${i}`}
            path={p}
            style="stroke"
            strokeWidth={1}
            strokeCap="round"
            color={seam}
            opacity={0.55}
          />
        ))}
        {garment?.buttons.map((b, i) => (
          <Circle
            key={`d${i}`}
            cx={b.x * scale}
            cy={b.y * scale}
            r={Math.max(1.4, 0.55 * scale)}
            color={button}
          />
        ))}
      </Group>
    </Canvas>
  );
}
