import type { ColorTraits, SeasonId } from "@/data/seasons";
import type { BodyShape } from "./bodyShape";

export const MRZ_LENGTH = 36;

export function passportName(displayName: string | undefined): string {
  const name = displayName?.trim();
  return name ? name.toUpperCase() : "SILO MEMBER";
}

/** Stable "SL·4F9A·21C7"-style number derived from the profile, not random. */
export function cardNumber(seed: string): string {
  let h = 5381;
  for (let i = 0; i < seed.length; i++)
    h = ((h << 5) + h + seed.charCodeAt(i)) >>> 0;
  const hex = h.toString(16).toUpperCase().padStart(8, "0");
  return `SL·${hex.slice(0, 4)}·${hex.slice(4, 8)}`;
}

const MONTHS = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
];

/** "17 OCT 2026", the date style printed on passports. */
export function formatIssued(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** Uppercase A-Z/0-9; accents are stripped and anything else becomes the "<" filler. */
function mrzField(text: string): string {
  return text
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Z0-9]+/g, "<");
}

function fit(line: string): string {
  return line.slice(0, MRZ_LENGTH).padEnd(MRZ_LENGTH, "<");
}

/** -0.46 -> "M46", 0.08 -> "P08": signed trait as three MRZ-safe characters. */
function trait(v: number): string {
  const n = Math.min(99, Math.round(Math.abs(v) * 100));
  return `${v < 0 ? "M" : "P"}${String(n).padStart(2, "0")}`;
}

/**
 * Two machine-readable-zone lines in the spirit of a passport's, encoding the
 * holder and their analysis. Decorative, but deterministic so the same profile
 * always prints the same card.
 */
export function mrzLines(p: {
  name: string;
  seasonId: SeasonId;
  traits: ColorTraits;
  heightCm?: number;
  shape?: BodyShape;
}): [string, string] {
  const line1 = fit(`P<SILO${mrzField(p.name)}<<${mrzField(p.seasonId)}`);
  const height = p.heightCm ? `H${Math.round(p.heightCm)}` : "H000";
  const shape = p.shape ? mrzField(p.shape) : "";
  const line2 = fit(
    `${trait(p.traits.warmth)}${trait(p.traits.depth)}${trait(p.traits.clarity)}<${height}<${shape}`,
  );
  return [line1, line2];
}

/**
 * One guilloche loop: a circle whose radius oscillates `petals` times per
 * turn. Overlaying many loops at shifted phases gives the interlaced rosette
 * printed on banknotes and passports. Flat [x0, y0, x1, y1, ...] list.
 */
export function rosettePoints(
  cx: number,
  cy: number,
  radius: number,
  petals: number,
  phase: number,
  depth = 0.18,
  steps = 360,
): number[] {
  const out: number[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const r = radius * (1 - depth + depth * Math.sin(petals * t + phase));
    out.push(cx + r * Math.cos(t), cy + r * Math.sin(t));
  }
  return out;
}

/** A horizontal sine band line, for the wave patterns behind passport text. */
export function wavePoints(
  x0: number,
  x1: number,
  y: number,
  amplitude: number,
  wavelength: number,
  phase: number,
  step = 3,
): number[] {
  const out: number[] = [];
  for (let x = x0; x <= x1; x += step) {
    out.push(
      x,
      y + amplitude * Math.sin((x / wavelength) * Math.PI * 2 + phase),
    );
  }
  return out;
}
