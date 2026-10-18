import type { RGB } from "./color.ts";
import type { Region, Rules } from "./evaluate.ts";

/** Gemini's documented box convention: [ymin, xmin, ymax, xmax], normalized to 0-1000. */
export type Box = [number, number, number, number];
export type LocatedRegions = Record<"face" | Region, Box | null>;
export type PixelBox = { x0: number; y0: number; x1: number; y1: number };
/** Tightly packed 8-bit RGB, row-major. */
export type RawImage = { data: Buffer; width: number; height: number };

export function toPixels([ymin, xmin, ymax, xmax]: Box, width: number, height: number): PixelBox {
  return {
    x0: Math.max(0, Math.floor((xmin / 1000) * width)),
    y0: Math.max(0, Math.floor((ymin / 1000) * height)),
    x1: Math.min(width, Math.ceil((xmax / 1000) * width)),
    y1: Math.min(height, Math.ceil((ymax / 1000) * height)),
  };
}

const wellFormed = (b: Box) =>
  b.every((v) => Number.isInteger(v) && v >= 0 && v <= 1000) && b[0] < b[2] && b[1] < b[3];
const center = (b: Box) => ({ y: (b[0] + b[2]) / 2, x: (b[1] + b[3]) / 2 });
const inside = (p: { x: number; y: number }, b: Box) => p.y >= b[0] && p.y <= b[2] && p.x >= b[1] && p.x <= b[3];
const area = (b: Box) => (b[2] - b[0]) * (b[3] - b[1]);
function overlapFraction(a: Box, b: Box): number {
  const h = Math.min(a[2], b[2]) - Math.max(a[0], b[0]);
  const w = Math.min(a[3], b[3]) - Math.max(a[1], b[1]);
  return h <= 0 || w <= 0 ? 0 : (h * w) / Math.min(area(a), area(b));
}

const FACE_PARTS = ["skin", "lips", "iris"] as const;

/**
 * Keeps boxes that are well formed and anatomically plausible. A rejected box
 * (as opposed to one Gemini did not return) marks localization questionable.
 * Without a usable face box nothing can be checked, so nothing is accepted.
 */
export function checkRegions(found: LocatedRegions, rules: Rules) {
  const rejected = new Set<string>();
  const ok: Partial<Record<"face" | Region, Box>> = {};
  for (const [name, box] of Object.entries(found) as ["face" | Region, Box | null][]) {
    if (box === null) continue;
    if (wellFormed(box)) ok[name] = box;
    else rejected.add(name);
  }
  const face = ok.face;
  if (!face) return { accepted: {}, rejected: [...rejected], questionable: rejected.size > 0 };

  for (const part of FACE_PARTS) {
    const box = ok[part];
    if (box && !inside(center(box), face)) rejected.add(part);
  }
  const { iris, lips } = ok;
  if (iris && lips && !rejected.has("iris") && !rejected.has("lips") && center(iris).y >= center(lips).y) {
    rejected.add("iris");
    rejected.add("lips");
  }
  for (let i = 0; i < FACE_PARTS.length; i++)
    for (let j = i + 1; j < FACE_PARTS.length; j++) {
      const a = ok[FACE_PARTS[i]];
      const b = ok[FACE_PARTS[j]];
      if (a && b && overlapFraction(a, b) > rules.plausibility.maxOverlapFraction) {
        rejected.add(FACE_PARTS[i]);
        rejected.add(FACE_PARTS[j]);
      }
    }
  for (const name of rejected) delete ok[name as Region];
  return { accepted: ok, rejected: [...rejected], questionable: rejected.size > 0 };
}

type SamplingParams = Rules["sampling"]["regions"]["skin"];

/**
 * Representative region color from real pixels, or null when too little
 * evidence survives filtering. Shrinks the box, drops DSCAS's too-dark and
 * too-bright pixels, trims shadows and highlights by luma, then takes the
 * per-channel median.
 * shortcut: a shrunken box is not a segmentation mask; clothing, eyebrows or
 * background can still leak in. Upgrade to Gemini segmentation masks if
 * real-photo testing shows contamination.
 */
export function sampleRegion(img: RawImage, box: PixelBox, p: SamplingParams, s: Rules["sampling"]): RGB | null {
  const dx = (box.x1 - box.x0) * p.innerShrink;
  const dy = (box.y1 - box.y0) * p.innerShrink;
  const x0 = Math.ceil(box.x0 + dx);
  const x1 = Math.floor(box.x1 - dx);
  const y0 = Math.ceil(box.y0 + dy);
  const y1 = Math.floor(box.y1 - dy);
  const [minSum, maxSum] = s.dscasPixelSumBounds;

  const pixels: { rgb: RGB; luma: number }[] = [];
  for (let y = y0; y < y1; y++)
    for (let x = x0; x < x1; x++) {
      const i = (y * img.width + x) * 3;
      const rgb: RGB = [img.data[i], img.data[i + 1], img.data[i + 2]];
      const sum = rgb[0] + rgb[1] + rgb[2];
      if (sum < minSum || sum > maxSum) continue;
      pixels.push({ rgb, luma: 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2] });
    }
  pixels.sort((a, b) => a.luma - b.luma);
  const kept = pixels.slice(Math.floor(pixels.length * p.trimDark), pixels.length - Math.floor(pixels.length * p.trimBright));
  if (kept.length < s.minPixels) return null;

  const median = (c: 0 | 1 | 2) => {
    const v = kept.map((px) => px.rgb[c]).sort((a, b) => a - b);
    const mid = v.length >> 1;
    return v.length % 2 ? v[mid] : Math.round((v[mid - 1] + v[mid]) / 2);
  };
  return [median(0), median(1), median(2)];
}
