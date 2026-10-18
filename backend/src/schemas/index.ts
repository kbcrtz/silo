import { z } from "zod";
import { WARNINGS } from "../analysis/evaluate.ts";

/** Gemini's box convention: [ymin, xmin, ymax, xmax], normalized to 0-1000. Null = not clearly visible. */
const box = z.array(z.int().min(0).max(1000)).length(4).nullable();

export const ObservationSchema = z.strictObject({
  face: box,
  skin: box,
  lips: box,
  hair: box,
  iris: box,
  warnings: z.strictObject(Object.fromEntries(WARNINGS.map((w) => [w, z.boolean()])) as Record<(typeof WARNINGS)[number], z.ZodBoolean>),
});

/** The response the Expo app already expects from POST /color-analysis (frontend/src/api/colorAnalysis.ts). */
export const ColorAnalysisResponseSchema = z.strictObject({
  warmth: z.number().min(-1).max(1),
  depth: z.number().min(-1).max(1),
  clarity: z.number().min(-1).max(1),
  confidence: z.number().min(0).max(1),
});
