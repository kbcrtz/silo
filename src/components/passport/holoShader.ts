import { Skia } from "@shopify/react-native-skia";
import { hexToRgb } from "@/lib/color";

/**
 * Holographic foil, evaluated per pixel on the GPU.
 *
 * - Thin-film rainbow: real holo foil shows interference bands whose hue
 *   depends on viewing angle. The band phase runs diagonally across the card
 *   and shifts with tilt, so the bands sweep as the card moves.
 * - Palette ramp: the rainbow is blended toward a ping-pong ramp of the
 *   user's three signature colors, so every season's foil looks different.
 * - Glare: a reflected-light hotspot that slides opposite the tilt.
 * - Glitter: 2.5px cells, each flashing at its own tilt angle.
 *
 * Uniforms: resolution (px), tilt (-1..1 per axis), tintA/B/C (rgb 0..1),
 * glitter (0..1).
 */
const SOURCE = `
uniform float2 resolution;
uniform float2 tilt;
uniform float3 tintA;
uniform float3 tintB;
uniform float3 tintC;
uniform float glitter;

float hash(float2 p) {
  p = fract(p * float2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

half4 main(float2 pos) {
  float2 uv = pos / resolution;

  float phase = dot(uv - 0.5, float2(0.62, 0.78)) * 1.6 + tilt.x * 0.9 - tilt.y * 0.7;
  float3 film = 0.5 + 0.5 * cos(6.28318 * (phase + float3(0.0, 0.33, 0.67)));

  float s = abs(fract(phase * 0.5) * 2.0 - 1.0);
  float3 palette = s < 0.5 ? mix(tintA, tintB, s * 2.0) : mix(tintB, tintC, (s - 0.5) * 2.0);

  float3 color = mix(film, palette, 0.55);
  color = mix(color, float3(1.0), 0.18);

  float2 light = float2(0.5 - tilt.x * 0.55, 0.35 - tilt.y * 0.55);
  float glare = pow(clamp(1.0 - distance(uv, light) * 1.6, 0.0, 1.0), 2.0);
  color += glare * 0.45;

  float2 cell = floor(pos / 2.5);
  float h = hash(cell);
  float flash = fract(h * 9.0 + tilt.x * 1.7 + tilt.y * 1.1);
  float sparkle = smoothstep(0.94, 1.0, flash) * step(0.55, h) * glitter;
  color += sparkle * 0.8;

  return half4(half3(clamp(color, 0.0, 1.0)), 1.0);
}
`;

const effect = Skia.RuntimeEffect.Make(SOURCE);
if (!effect) throw new Error("Holo foil shader failed to compile");

export const holoEffect = effect;

export function rgb01(hex: string): [number, number, number] {
  const { r, g, b } = hexToRgb(hex);
  return [r / 255, g / 255, b / 255];
}
