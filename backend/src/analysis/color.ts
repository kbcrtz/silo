/** 8-bit sRGB triplet. */
export type RGB = readonly [number, number, number];
export type Lab = { l: number; a: number; b: number };

/** HSV saturation and value in 0..1, as OpenCV computes them on float RGB (DSCAS uses cv2.COLOR_RGB2HSV). */
export function rgbToHsv([r, g, b]: RGB): { s: number; v: number } {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return { s: max === 0 ? 0 : (max - min) / max, v: max / 255 };
}

function toLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** sRGB -> CIELAB (D65), matching skimage.color.rgb2lab, which DSCAS uses. */
export function rgbToLab([r, g, b]: RGB): Lab {
  const [lr, lg, lb] = [toLinear(r), toLinear(g), toLinear(b)];
  const x = (lr * 0.412453 + lg * 0.35758 + lb * 0.180423) / 0.95047;
  const y = lr * 0.212671 + lg * 0.71516 + lb * 0.072169;
  const z = (lr * 0.019334 + lg * 0.119193 + lb * 0.950227) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const [fx, fy, fz] = [f(x), f(y), f(z)];
  return { l: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}

/** CIE76 color difference: Euclidean distance in CIELAB. */
export function deltaE76(a: RGB, b: RGB): number {
  const x = rgbToLab(a);
  const y = rgbToLab(b);
  return Math.hypot(x.l - y.l, x.a - y.a, x.b - y.b);
}
