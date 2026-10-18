import { z } from "zod";
import { HttpError } from "../errors.ts";
import type { Warnings } from "../analysis/evaluate.ts";
import type { Box, LocatedRegions } from "../analysis/regions.ts";
import { ObservationSchema } from "../schemas/index.ts";

/** The one SDK call this adapter makes; injected so tests never reach the network. */
export type CreateInteraction = (
  params: Record<string, unknown>,
  options: { timeout_ms: number; retries: { strategy: "none" } },
) => Promise<{ output_text?: string }>;

const PROMPT = `You locate facial regions in a selfie for color analysis. Return bounding boxes as [ymin, xmin, ymax, xmax] normalized to 0-1000 relative to the image.
- face: the whole face. Null if there is no face or more than one face.
- skin: a patch of bare skin on one cheek or the forehead, with no hair, eyebrows, glasses, shadow or shine. Keep the box inside the skin.
- lips: the lips only.
- hair: an area of scalp hair, not eyebrows or beard. Null if no hair is visible (bald, covered or out of frame).
- iris: the colored iris of one clearly visible eye, tight around it. Null if the eyes are closed, hidden or behind tinted glasses.
Use null for any region that is not clearly visible. Never guess a location.
Set a warning to true only when it is clearly present:
- lipMakeup: lipstick, lip tint or gloss changes the natural lip color, or it reasonably seems to.
- colorCast: lighting or white balance tints the whole image.
- beautyFilter: a smoothing, beauty or color filter has been applied.
- occlusion: hands, hair, a mask or glasses cover part of the face.
- unevenLighting: strong shadows, or one side of the face much brighter than the other.
- overexposed / underexposed: the face is washed out or too dark to read its colors.
- blur: the face is noticeably out of focus or motion blurred.
- unreliableRegions: you are unsure about any box you returned.`;

/** A failed Gemini call as the HttpError the app receives; the provider status is kept for logs. */
export function providerError(e: unknown): HttpError {
  const timedOut = e instanceof Error && ["APIConnectionTimeoutError", "RequestTimeoutError", "TimeoutError", "AbortError"].includes(e.name);
  const status = (e as { status?: unknown }).status;
  return timedOut ? new HttpError("gemini_timeout", 504) : new HttpError("gemini_failed", 502, typeof status === "number" ? status : undefined);
}

// Gemini takes a JSON Schema; the draft URI is not part of its supported subset.
const { $schema: _, ...RESPONSE_SCHEMA } = z.toJSONSchema(ObservationSchema);

export async function locateRegions(
  jpeg: Buffer,
  opts: { create: CreateInteraction; model: string; timeoutMs: number },
): Promise<{ regions: LocatedRegions; warnings: Warnings }> {
  let text: string | undefined;
  try {
    const interaction = await opts.create(
      {
        model: opts.model,
        input: [
          { type: "text", text: PROMPT },
          { type: "image", data: jpeg.toString("base64"), mime_type: "image/jpeg" },
        ],
        response_format: { type: "text", mime_type: "application/json", schema: RESPONSE_SCHEMA },
        // Don't keep the selfie as a stored interaction. Provider abuse-monitoring terms may still apply.
        store: false,
      },
      { timeout_ms: opts.timeoutMs, retries: { strategy: "none" } },
    );
    text = interaction.output_text;
  } catch (e) {
    throw providerError(e);
  }

  let parsed: z.infer<typeof ObservationSchema>;
  try {
    parsed = ObservationSchema.parse(JSON.parse(text ?? ""));
  } catch {
    throw new HttpError("gemini_invalid_output", 502);
  }
  const { warnings, ...boxes } = parsed;
  return { regions: boxes as Record<keyof typeof boxes, Box | null>, warnings };
}
