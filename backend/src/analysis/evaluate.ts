import { z } from "zod";
import { deltaE76, rgbToHsv, type RGB } from "./color.ts";

export type Region = "skin" | "lips" | "hair" | "iris";
export type OptionalRegion = Exclude<Region, "skin">;
export type Colors = Partial<Record<Region, RGB>>;

export const WARNINGS = [
  "lipMakeup",
  "colorCast",
  "beautyFilter",
  "occlusion",
  "unevenLighting",
  "overexposed",
  "underexposed",
  "blur",
  "unreliableRegions",
] as const;
export type Warnings = Record<(typeof WARNINGS)[number], boolean>;

const unit = z.number().min(0).max(1);
const positive = z.number().positive();
const rgb = z.tuple([z.int().min(0).max(255), z.int().min(0).max(255), z.int().min(0).max(255)]);
const sampling = z.object({ innerShrink: z.number().min(0).max(0.45), trimDark: unit, trimBright: unit });

// Validates the fields the code reads; descriptive notes in the document are allowed and ignored.
const RulesSchema = z.object({
  version: z.string().min(1),
  referenceColors: z.object({ peach: rgb, purple: rgb }),
  cutoffs: z.object({ intensity: unit, value: unit, contrast: unit }),
  normalization: z.object({
    warmthSpread: positive,
    depthSpread: positive,
    intensitySpread: positive,
    contrastSpread: positive,
    intensityWeight: unit,
    contrastWeight: unit,
  }),
  confidence: z.object({
    start: unit,
    penalties: z.object({
      colorCast: unit,
      unevenLighting: unit,
      blur: unit,
      beautyFilter: unit,
      questionableLocalization: unit,
      occlusion: unit,
      overexposed: unit,
      underexposed: unit,
    }),
    caps: z.object({ lips: unit, hair: unit, iris: unit }),
  }),
  sampling: z.object({
    dscasPixelSumBounds: z.tuple([z.int().min(0), z.int().max(765)]),
    minPixels: z.int().positive(),
    regions: z.object({ skin: sampling, lips: sampling, hair: sampling, iris: sampling }),
  }),
  plausibility: z.object({ maxOverlapFraction: unit }),
});
export type Rules = z.infer<typeof RulesSchema>;

export function loadRules(doc: unknown): Rules {
  return RulesSchema.parse(doc);
}

const clamp = (v: number, lo = -1, hi = 1) => Math.max(lo, Math.min(hi, v));

/** DSCAS measurements. Undefined = the inputs for that metric were unavailable. */
export type Metrics = {
  /** deltaE(lips, purple) - deltaE(lips, peach): positive = closer to peach = warmer. */
  subtoneGap?: number;
  intensity?: number;
  value?: number;
  contrast?: number;
};

export function colorsToMetrics(c: Colors, rules: Rules): Metrics {
  const { peach, purple } = rules.referenceColors;
  const brightness = [c.skin, c.hair, c.iris].filter((x) => x !== undefined).map((x) => rgbToHsv(x).v);
  return {
    subtoneGap: c.lips ? deltaE76(c.lips, purple) - deltaE76(c.lips, peach) : undefined,
    intensity: c.skin ? rgbToHsv(c.skin).s : undefined,
    value: c.skin ? brightness.reduce((a, b) => a + b, 0) / brightness.length : undefined,
    contrast: c.hair && c.iris ? Math.abs(rgbToHsv(c.hair).v - rgbToHsv(c.iris).v) : undefined,
  };
}

/** Requires intensity and value (both come from skin). */
export function metricsToTraits(m: Metrics & { intensity: number; value: number }, rules: Rules) {
  const { cutoffs: c, normalization: n } = rules;
  const intensityTerm = (m.intensity - c.intensity) / n.intensitySpread;
  const clarity =
    m.contrast === undefined
      ? intensityTerm
      : n.intensityWeight * intensityTerm + n.contrastWeight * ((m.contrast - c.contrast) / n.contrastSpread);
  return {
    warmth: m.subtoneGap === undefined ? 0 : clamp(m.subtoneGap / n.warmthSpread),
    depth: clamp((c.value - m.value) / n.depthSpread),
    clarity: clamp(clarity),
  };
}

const PENALIZED = ["colorCast", "unevenLighting", "blur", "beautyFilter", "occlusion", "overexposed", "underexposed"] as const;
const OPTIONAL: OptionalRegion[] = ["lips", "hair", "iris"];

export function scoreConfidence(
  input: { warnings: Warnings; missing: OptionalRegion[]; localizationQuestionable: boolean },
  rules: Rules,
) {
  const { start, penalties: p, caps: c } = rules.confidence;
  const penalties: string[] = PENALIZED.filter((w) => input.warnings[w]);
  if (input.warnings.unreliableRegions || input.localizationQuestionable) penalties.push("questionableLocalization");
  const caps = OPTIONAL.filter((r) => input.missing.includes(r));
  const penalized = start - penalties.reduce((sum, k) => sum + p[k as keyof typeof p], 0);
  const confidence = clamp(Math.min(penalized, ...caps.map((r) => c[r])), 0, 1);
  return { confidence, penalties, caps };
}

export type ColorAnalysisResponse = { warmth: number; depth: number; clarity: number; confidence: number };

export type Diagnostics = {
  metrics: Record<"subtone" | "intensity" | "value" | "contrast", boolean>;
  penalties: string[];
  caps: string[];
};

export function evaluate(
  input: { colors: Colors; warnings: Warnings; localizationQuestionable: boolean },
  rules: Rules,
): { ok: true; response: ColorAnalysisResponse; diagnostics: Diagnostics } | { ok: false; reason: "no_usable_skin"; diagnostics: Diagnostics } {
  // Lip makeup hides the natural lip color DSCAS reads warmth from.
  const colors = input.warnings.lipMakeup ? { ...input.colors, lips: undefined } : input.colors;
  const m = colorsToMetrics(colors, rules);
  const missing = OPTIONAL.filter((r) => colors[r] === undefined);
  const scored = scoreConfidence({ warnings: input.warnings, missing, localizationQuestionable: input.localizationQuestionable }, rules);
  const diagnostics: Diagnostics = {
    metrics: {
      subtone: m.subtoneGap !== undefined,
      intensity: m.intensity !== undefined,
      value: m.value !== undefined,
      contrast: m.contrast !== undefined,
    },
    penalties: scored.penalties,
    caps: scored.caps,
  };
  if (m.intensity === undefined || m.value === undefined) return { ok: false, reason: "no_usable_skin", diagnostics };
  const traits = metricsToTraits({ ...m, intensity: m.intensity, value: m.value }, rules);
  return { ok: true, response: { ...traits, confidence: scored.confidence }, diagnostics };
}
