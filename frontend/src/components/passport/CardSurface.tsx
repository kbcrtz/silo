import {
  FractalNoise,
  Group,
  LinearGradient,
  Path,
  RoundedRect,
  Shader,
  Skia,
  vec,
  type SkPath,
  type Uniforms,
  BlurMask,
} from "@shopify/react-native-skia";
import { useMemo, type ReactNode } from "react";
import type { Season } from "@/data/seasons";
import {
  cardStock,
  rosettePoints,
  wavePoints,
  type CardStock,
} from "@/lib/passport";
import { buildTheme } from "@/theme";
import { holoEffect } from "./holoShader";

/** Animated shader inputs (a Reanimated derived value); see holoShader.ts for the fields. */
export type HoloUniforms = { readonly value: Uniforms };

export const CARD_RADIUS = 18;
/**
 * Transparent margin around the card inside each canvas, for the drop
 * shadow. The shadow is drawn in Skia rather than as a native view: a native
 * shadow plate is a separate 3D layer, and iOS depth-sorts it against the
 * rotating card so it slices through the card along the rotation axis.
 */
export const CARD_PAD = 32;

/** Paint child: fills the parent drawing with holographic foil. */
export function Holo({ uniforms }: { uniforms: HoloUniforms }) {
  return <Shader source={holoEffect} uniforms={uniforms} />;
}

export function polyline(points: number[], close = false): SkPath {
  const path = Skia.Path.Make();
  path.moveTo(points[0], points[1]);
  for (let i = 2; i < points.length; i += 2)
    path.lineTo(points[i], points[i + 1]);
  if (close) path.close();
  return path;
}

/** Interlaced guilloche rosette: `loops` oscillating circles at shifted phases, as one path. */
export function rosettePath(
  cx: number,
  cy: number,
  r: number,
  loops: number,
  petals: number,
): SkPath {
  const path = Skia.Path.Make();
  for (let i = 0; i < loops; i++) {
    path.addPath(
      polyline(
        rosettePoints(cx, cy, r, petals, (i / loops) * Math.PI * 2),
        true,
      ),
    );
  }
  return path;
}

/** Card paper and ink for a season, matched to the app theme. */
export function useCardStock(season: Season): CardStock {
  return useMemo(
    () => cardStock(season, buildTheme(season.id).colors.bg),
    [season],
  );
}

type Props = {
  width: number;
  height: number;
  season: Season;
  /** Foil for thin lines (no glitter). */
  uniforms: HoloUniforms;
  /** Foil for filled areas (with glitter). */
  fillUniforms: HoloUniforms;
  /** Center of the background rosette, as fractions of the card. */
  rosette: [number, number];
  children: ReactNode;
};

/**
 * Everything both faces share, in paint order: tinted card stock, paper grain,
 * guilloche security pattern, then the face's content, then a foil border and
 * a faint holographic laminate over the whole card (the laminate is what makes
 * the matte content still catch light as it tilts).
 */
export function CardSurface({
  width: w,
  height: h,
  season,
  uniforms,
  fillUniforms,
  rosette,
  children,
}: Props) {
  const stock = useCardStock(season);
  const ink = stock.ink;
  const u = w / 100;

  const patterns = useMemo(() => {
    const waves = Skia.Path.Make();
    for (let i = 0; i < 16; i++) {
      waves.addPath(
        polyline(
          wavePoints(
            4 * u,
            w - 4 * u,
            4 * u + i * 1.1 * u,
            1.4 * u,
            34 * u,
            i * 0.38,
          ),
        ),
      );
    }
    return {
      waves,
      rosette: rosettePath(rosette[0] * w, rosette[1] * h, 30 * u, 18, 11),
      inner: rosettePath(rosette[0] * w, rosette[1] * h, 17 * u, 12, 7),
    };
  }, [w, h, u, rosette]);

  return (
    <Group transform={[{ translateX: CARD_PAD }, { translateY: CARD_PAD }]}>
      <RoundedRect
        x={4}
        y={14}
        width={w - 8}
        height={h - 8}
        r={CARD_RADIUS}
        color="#000000"
        opacity={0.3}
      >
        <BlurMask blur={16} style="normal" />
      </RoundedRect>
      <RoundedRect x={0} y={0} width={w} height={h} r={CARD_RADIUS}>
        <LinearGradient
          start={vec(0, 0)}
          end={vec(w, h)}
          colors={stock.colors}
          positions={stock.positions}
        />
      </RoundedRect>
      <Group
        clip={Skia.RRectXY(Skia.XYWHRect(0, 0, w, h), CARD_RADIUS, CARD_RADIUS)}
      >
        <RoundedRect
          x={0}
          y={0}
          width={w}
          height={h}
          r={CARD_RADIUS}
          opacity={0.07}
          blendMode="multiply"
        >
          <FractalNoise freqX={0.8} freqY={0.8} octaves={3} />
        </RoundedRect>
        <Path
          path={patterns.waves}
          style="stroke"
          strokeWidth={0.5}
          color={ink}
          opacity={0.14}
        />
        <Path
          path={patterns.rosette}
          style="stroke"
          strokeWidth={0.45}
          color={season.signature}
          opacity={0.15}
        />
        <Path
          path={patterns.inner}
          style="stroke"
          strokeWidth={0.45}
          color={ink}
          opacity={0.12}
        />

        {children}

        <RoundedRect
          x={0}
          y={0}
          width={w}
          height={h}
          r={CARD_RADIUS}
          opacity={0.22}
          blendMode="softLight"
        >
          <Holo uniforms={fillUniforms} />
        </RoundedRect>
        <RoundedRect
          x={0}
          y={0}
          width={w}
          height={h}
          r={CARD_RADIUS}
          opacity={0.07}
          blendMode="screen"
        >
          <Holo uniforms={fillUniforms} />
        </RoundedRect>
      </Group>
      <RoundedRect
        x={2.5 * u}
        y={2.5 * u}
        width={w - 5 * u}
        height={h - 5 * u}
        r={CARD_RADIUS - 2.5 * u}
        style="stroke"
        strokeWidth={1.4}
      >
        <Holo uniforms={uniforms} />
      </RoundedRect>
      <RoundedRect
        x={3.6 * u}
        y={3.6 * u}
        width={w - 7.2 * u}
        height={h - 7.2 * u}
        r={CARD_RADIUS - 3.6 * u}
        style="stroke"
        strokeWidth={0.5}
        color={ink}
        opacity={0.3}
      />
    </Group>
  );
}
