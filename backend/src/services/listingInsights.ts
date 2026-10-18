import { z } from "zod";
import type { ListingFacts } from "../catalog/normalize.ts";
import { HttpError } from "../errors.ts";
import { providerError, type CreateInteraction } from "./colorVision.ts";

// The app's catalog vocabulary (frontend/src/data/catalog.ts), so its mannequin can draw the cut.
const GARMENTS = ["top", "bottom", "dress", "outerwear"] as const;
const SILHOUETTES = ["fitted", "relaxed", "boxy", "wrap", "tailored", "cropped", "slip", "a-line", "slim", "straight", "wide-leg"] as const;
const LENGTHS = ["waist", "hip", "thigh", "knee", "midi", "ankle"] as const;
const SLEEVES = ["none", "short", "long"] as const;

const Item = z.strictObject({
  i: z.int().min(0),
  hex: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .nullable(),
  confidence: z.enum(["high", "medium", "low"]),
  category: z.enum(GARMENTS),
  silhouette: z.enum(SILHOUETTES),
  length: z.enum(LENGTHS),
  sleeve: z.enum(SLEEVES).nullable(),
  evidence: z.string().max(200),
});
// Gemini takes a JSON Schema; the draft URI is not part of its supported subset.
const { $schema: _, ...RESPONSE_SCHEMA } = z.toJSONSchema(z.strictObject({ items: z.array(Item) }));

export type Insight = {
  /** The garment's main color as the listing describes it; null when the text gives none. */
  hex: string | null;
  confidence: "high" | "medium" | "low";
  cut: { category: (typeof GARMENTS)[number]; silhouette: (typeof SILHOUETTES)[number]; length: (typeof LENGTHS)[number]; sleeve?: (typeof SLEEVES)[number] };
  /** The listing's own words the estimate rests on. */
  evidence: string;
};
/** One estimate per listing, in order; null where the model gave nothing usable. */
export type Enrich = (listings: ListingFacts[]) => Promise<(Insight | null)[]>;

/** Listings per Gemini call; a 20-item page makes four calls at once. */
const BATCH = 5;

const PROMPT = `You read clothing store listings and describe each garment for a color and fit app. Use only the listing text. Never guess beyond it. When the labeled specs state a fit, length or sleeve, use them over the title and description.
For each listing, by its index i:
- hex: the garment's main color as #RRGGBB, from its color name and description. Fanciful names ("Bering Sea", "Roasted Pecan") mean their usual color. For a print or several colors, the dominant one. Null if the text gives no color.
- confidence: high when the text names a specific color, medium when the name is vague or fanciful, low when you are inferring from very little.
- category: top, bottom, dress, or outerwear (jackets, coats, blazers, cardigans).
- silhouette: the closest of fitted, relaxed, boxy, wrap, tailored, cropped, slip, a-line, slim, straight, wide-leg.
- length: where the hem falls on the body: waist, hip, thigh, knee, midi or ankle.
- sleeve: none, short or long. Null for bottoms.
- evidence: the few words from the listing you relied on, under 10 words.`;

/**
 * Estimates each listing's color and cut from its text, in a few small
 * parallel Gemini calls per feed page. Only store listing text is sent: nothing about the shopper,
 * and no product images (Shopify's catalog terms limit those to display).
 */
export function createEnricher(opts: { create: CreateInteraction; model: string; timeoutMs: number }): Enrich {
  async function ask(listings: ListingFacts[]): Promise<(Insight | null)[]> {
    let text: string | undefined;
    try {
      const interaction = await opts.create(
        {
          model: opts.model,
          input: [
            { type: "text", text: PROMPT },
            { type: "text", text: JSON.stringify(listings.map((facts, i) => ({ i, ...facts }))) },
          ],
          response_format: { type: "text", mime_type: "application/json", schema: RESPONSE_SCHEMA },
          // Reading labels off a listing needs little reasoning, and thinking costs seconds on every page.
          // "low", not "minimal": gemini-3.8-flash rejects minimal with a 400.
          generation_config: { thinking_level: "low" },
          store: false,
        },
        { timeout_ms: opts.timeoutMs, retries: { strategy: "none" } },
      );
      text = interaction.output_text;
    } catch (e) {
      throw providerError(e);
    }

    let items: unknown[];
    try {
      items = z.object({ items: z.array(z.unknown()) }).parse(JSON.parse(text ?? "")).items;
    } catch {
      throw new HttpError("gemini_invalid_output", 502);
    }
    const out: (Insight | null)[] = listings.map(() => null);
    for (const raw of items) {
      const item = Item.safeParse(raw);
      if (!item.success || item.data.i >= out.length || out[item.data.i]) continue;
      const { hex, confidence, category, silhouette, length, sleeve, evidence } = item.data;
      out[item.data.i] = { hex, confidence, cut: { category, silhouette, length, ...(sleeve && category !== "bottom" && { sleeve }) }, evidence };
    }
    return out;
  }

  // Latency follows output length, so small batches in parallel answer a page in about the time of one.
  return async (listings) => {
    const batches = Array.from({ length: Math.ceil(listings.length / BATCH) }, (_, b) => listings.slice(b * BATCH, (b + 1) * BATCH));
    const settled = await Promise.allSettled(batches.map(ask));
    const failed = settled.find((r) => r.status === "rejected");
    if (failed && settled.every((r) => r.status === "rejected")) throw failed.reason;
    return settled.flatMap((r, b) => (r.status === "fulfilled" ? r.value : batches[b].map(() => null)));
  };
}
