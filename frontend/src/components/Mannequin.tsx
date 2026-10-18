import {
  BlurMask,
  Canvas,
  Circle,
  Group,
  LinearGradient,
  Oval,
  Path,
  Rect,
  Shadow,
  vec,
} from "@shopify/react-native-skia";
import { useMemo, type ReactNode } from "react";
import type { CatalogItem } from "@/data/catalog";
import { deltaE, mix } from "@/lib/color";
import {
  bodyOutlines,
  landmarks,
  outfit,
  patternBands,
  type Garment,
} from "@/lib/mannequin";
import type { Measurements } from "@/lib/measurements";
import type { ShopFor } from "@/store/profile";
import { useTheme, type Theme } from "@/theme";
import { smooth } from "./skia/smooth";

type Props = {
  measurements: Measurements;
  shopFor: ShopFor;
  item?: CatalogItem;
  height: number;
};

/**
 * A front-view mannequin built from the user's measurements, wearing the
 * item in its cut and color, with plain pieces to complete the outfit.
 * With no item it is just the figure.
 */
export function Mannequin(props: Props) {
  const t = useTheme();
  return (
    <Canvas style={{ width: props.height * 0.5, height: props.height }}>
      <MannequinFigure {...props} colors={t.colors} />
    </Canvas>
  );
}

/** The drawing itself, without a canvas, so it can render offscreen too. */
export function MannequinFigure({
  measurements,
  shopFor,
  item,
  height,
  colors,
}: Props & { colors: Theme["colors"] }) {
  const L = useMemo(
    () => landmarks(measurements, shopFor),
    [measurements, shopFor],
  );
  const body = useMemo(() => bodyOutlines(L), [L]);
  const layers = useMemo(() => (item ? outfit(L, item) : []), [L, item]);

  // A little headroom above and floor below for the shadow.
  const scale = (height * 0.92) / L.H;
  const width = height * 0.5;
  // Shading is sized in centimeters so it looks the same at any size.
  const cm = (n: number) => n * scale;

  const paths = useMemo(
    () => ({
      head: smooth(body.head, scale, true),
      silhouette: smooth(body.silhouette, scale, true),
      contours: body.contours.map((c) => smooth(c, scale, false)),
      layers: layers.map((layer) => ({
        role: layer.role,
        ...garmentPaths(layer.garment, scale),
      })),
    }),
    [body, layers, scale],
  );

  // Light comes from the upper left, so the right-hand side falls off.
  const halfSpan = width / 2;
  const shade = (light: string, dark: string) => (
    <LinearGradient
      start={vec(-halfSpan, 0)}
      end={vec(halfSpan, 0)}
      colors={[mix(light, dark, 0.35), light, light, dark]}
      positions={[0, 0.3, 0.5, 1]}
    />
  );
  // Inner shadows round every edge off, so flat outlines read as volume.
  const volume = (rim: string, glow: string, depth: number) => (
    <>
      <Shadow dx={-cm(0.9)} dy={-cm(0.5)} blur={cm(depth)} color={rim} inner />
      <Shadow
        dx={cm(0.5)}
        dy={cm(0.4)}
        blur={cm(depth * 0.8)}
        color={glow}
        inner
      />
    </>
  );

  const skin = mix(colors.surface, colors.border, 0.5);
  const skinDark = mix(colors.border, colors.textMuted, 0.5);
  // No known color: neutral, never the season accent, which would look like the item's color.
  const itemColor =
    item?.colors[0] ?? mix(colors.surface, colors.textMuted, 0.5);
  // The plain pieces take whichever of a light or dark tone stands apart from the item.
  const apart = (light: string, dark: string) =>
    deltaE(itemColor, light) >= deltaE(itemColor, dark) ? light : dark;
  const base = {
    top: apart(
      mix(colors.surface, colors.textMuted, 0.18),
      mix(colors.text, colors.surface, 0.25),
    ),
    bottom: apart(
      mix(colors.surface, colors.textMuted, 0.35),
      mix(colors.text, colors.surface, 0.45),
    ),
  };

  return (
    <Group
      transform={[{ translateX: width / 2 }, { translateY: height * 0.03 }]}
    >
      <Oval
        x={-width * 0.26}
        y={cm(L.H) - height * 0.014}
        width={width * 0.52}
        height={height * 0.035}
        color={colors.text}
        opacity={0.16}
      >
        <BlurMask blur={cm(2.5)} style="normal" />
      </Oval>

      <Path path={paths.silhouette}>
        {shade(skin, skinDark)}
        {volume("rgba(0,0,0,0.28)", "rgba(255,255,255,0.55)", 2.2)}
      </Path>
      {paths.contours.map((p, i) => (
        <Path
          key={`c${i}`}
          path={p}
          style="stroke"
          strokeWidth={cm(0.35)}
          strokeCap="round"
          color={skinDark}
          opacity={0.45}
        >
          <BlurMask blur={cm(0.4)} style="normal" />
        </Path>
      ))}
      <Path path={paths.head}>
        {shade(skin, skinDark)}
        {volume("rgba(0,0,0,0.26)", "rgba(255,255,255,0.6)", 2.6)}
      </Path>

      {paths.layers.map((layer, li) => {
        const fill =
          layer.role === "item"
            ? itemColor
            : layer.role === "baseTop"
              ? base.top
              : base.bottom;
        return (
          <Fabric
            key={li}
            color={fill}
            trim={layer.role === "item" ? item?.colors[1] : undefined}
            pattern={layer.role === "item" ? item?.pattern : undefined}
            paths={layer}
            cm={cm}
            shade={shade}
            volume={volume}
          />
        );
      })}
    </Group>
  );
}

function garmentPaths(g: Garment, scale: number) {
  return {
    parts: g.parts.map((o) => smooth(o, scale, true)),
    lines: g.lines.map((l) => smooth(l, scale, false)),
    folds: g.folds.map((l) => ({
      path: smooth(l, scale, false),
      from: vec(l[0].x * scale, l[0].y * scale),
      to: vec(l[l.length - 1].x * scale, l[l.length - 1].y * scale),
    })),
    buttons: g.buttons,
  };
}

/** A crease fades in from where it starts and softens toward its end. */
function fade(
  f: { from: ReturnType<typeof vec>; to: ReturnType<typeof vec> },
  color: string,
) {
  return (
    <LinearGradient
      start={f.from}
      end={f.to}
      colors={[`${color}00`, color, `${color}99`]}
      positions={[0, 0.4, 1]}
    />
  );
}

/** One garment: shaded panels, soft creases, seams and buttons. */
function Fabric({
  color,
  trim,
  pattern,
  paths,
  cm,
  shade,
  volume,
}: {
  color: string;
  trim?: string;
  pattern?: CatalogItem["pattern"];
  paths: ReturnType<typeof garmentPaths>;
  cm: (n: number) => number;
  shade: (light: string, dark: string) => ReactNode;
  volume: (rim: string, glow: string, depth: number) => ReactNode;
}) {
  const light = mix(color, "#FFFFFF", 0.14);
  const dark = mix(color, "#000000", 0.3);
  const seam = mix(color, "#000000", 0.45);
  const button = trim ?? mix(color, "#000000", 0.5);
  return (
    <Group>
      {paths.parts.map((p, i) => (
        <Group key={`p${i}`}>
          {/* The garment's shadow on whatever is under it. */}
          <Path path={p} color="rgba(0,0,0,0.22)">
            <Shadow
              dx={cm(0.2)}
              dy={cm(0.5)}
              blur={cm(0.8)}
              color="rgba(0,0,0,0.35)"
              shadowOnly
            />
          </Path>
          <Path path={p}>
            {shade(light, dark)}
            {volume("rgba(0,0,0,0.32)", "rgba(255,255,255,0.28)", 1.6)}
          </Path>
          {/* Plaid or stripes in the second color, over the shading so the folds still show through. */}
          {pattern && trim ? (
            <Group clip={p} opacity={0.55}>
              {patternBands(p.getBounds(), pattern, cm(1)).map((b, k) => (
                <Rect
                  key={k}
                  x={b.x}
                  y={b.y}
                  width={b.width}
                  height={b.height}
                  color={trim}
                />
              ))}
            </Group>
          ) : null}
          <Path
            path={p}
            style="stroke"
            strokeWidth={cm(0.18)}
            color={seam}
            opacity={0.5}
          />
        </Group>
      ))}
      {paths.folds.map((f, i) => (
        <Group key={`f${i}`}>
          <Path
            path={f.path}
            style="stroke"
            strokeWidth={cm(0.7)}
            strokeCap="round"
            opacity={0.6}
          >
            {fade(f, dark)}
            <BlurMask blur={cm(0.6)} style="normal" />
          </Path>
          <Group transform={[{ translateX: -cm(0.45) }]}>
            <Path
              path={f.path}
              style="stroke"
              strokeWidth={cm(0.4)}
              strokeCap="round"
              opacity={0.5}
            >
              {fade(f, light)}
              <BlurMask blur={cm(0.5)} style="normal" />
            </Path>
          </Group>
        </Group>
      ))}
      {paths.lines.map((p, i) => (
        <Path
          key={`l${i}`}
          path={p}
          style="stroke"
          strokeWidth={cm(0.18)}
          strokeCap="round"
          color={seam}
          opacity={0.6}
        />
      ))}
      {paths.buttons.map((b, i) => (
        <Group key={`b${i}`}>
          <Circle
            cx={cm(b.x)}
            cy={cm(b.y)}
            r={Math.max(1.4, cm(0.55))}
            color={button}
          />
          <Circle
            cx={cm(b.x) - cm(0.15)}
            cy={cm(b.y) - cm(0.15)}
            r={Math.max(0.5, cm(0.18))}
            color="rgba(255,255,255,0.45)"
          />
        </Group>
      ))}
    </Group>
  );
}
