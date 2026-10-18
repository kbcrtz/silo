import type { FastifyInstance } from "fastify";
import { evaluate, type Colors, type Region, type Rules } from "../analysis/evaluate.ts";
import { checkRegions, sampleRegion, toPixels } from "../analysis/regions.ts";
import type { Locate } from "../app.ts";
import { ColorAnalysisResponseSchema } from "../schemas/index.ts";
import { HttpError } from "../errors.ts";
import { MAX_BYTES, prepareSelfie } from "../services/image.ts";

const REGIONS: Region[] = ["skin", "lips", "hair", "iris"];

/** Maps a thrown error to the `{ error }` reply. Unexpected errors are logged by name only. */
function toHttpError(e: unknown): HttpError | null {
  if (e instanceof HttpError) return e;
  const code = (e as { code?: string }).code;
  if (code === "FST_REQ_FILE_TOO_LARGE") return new HttpError("file_too_large", 413);
  if (code === "FST_INVALID_MULTIPART_CONTENT_TYPE") return new HttpError("missing_selfie", 400);
  return null;
}

/**
 * POST /color-analysis: multipart `selfie` -> { warmth, depth, clarity, confidence }.
 * Gemini localizes regions, the server samples real pixels, and the versioned
 * rules compute the traits. The app picks the season.
 */
export async function colorAnalysisRoute(app: FastifyInstance, { rules, locate, model }: { rules: Rules; locate: Locate; model: string }) {
  app.post("/color-analysis", async (req, reply) => {
    const started = performance.now();
    // Operational facts only: no images, colors, metric values or traits.
    const diag: Record<string, unknown> = { model, rulesVersion: rules.version };
    try {
      const file = await req.file({ limits: { fileSize: MAX_BYTES, files: 1 } });
      if (!file || file.fieldname !== "selfie") throw new HttpError("missing_selfie", 400);
      const image = await prepareSelfie(await file.toBuffer());

      const { regions, warnings } = await locate(image.modelJpeg);
      diag.regionsReturned = Object.fromEntries(Object.entries(regions).map(([k, v]) => [k, v !== null]));
      diag.warnings = Object.keys(warnings).filter((w) => warnings[w as keyof typeof warnings]);

      const checked = checkRegions(regions, rules);
      diag.regionsRejected = checked.rejected;
      const colors: Colors = {};
      const sampled: Record<string, boolean> = {};
      for (const region of REGIONS) {
        const box = checked.accepted[region];
        const color = box
          ? sampleRegion(image.raw, toPixels(box, image.raw.width, image.raw.height), rules.sampling.regions[region], rules.sampling)
          : null;
        sampled[region] = color !== null;
        if (color) colors[region] = color;
      }
      diag.sampled = sampled;

      const result = evaluate({ colors, warnings, localizationQuestionable: checked.questionable }, rules);
      Object.assign(diag, result.diagnostics);
      if (!result.ok) throw new HttpError("no_usable_face", 422);

      const checkedResponse = ColorAnalysisResponseSchema.safeParse(result.response);
      diag.outputValid = checkedResponse.success;
      if (!checkedResponse.success) throw new HttpError("evaluator_invalid_output", 500);
      return checkedResponse.data;
    } catch (e) {
      const known = toHttpError(e);
      if (!known) req.log.error({ errorName: (e as Error).name }, "color_analysis_unexpected");
      const err = known ?? new HttpError("internal_error", 500);
      diag.error = err.code;
      if (err.providerStatus) diag.providerStatus = err.providerStatus;
      return reply.code(err.status).send({ error: err.code });
    } finally {
      diag.durationMs = Math.round(performance.now() - started);
      req.log.info({ colorAnalysis: diag }, "color_analysis");
    }
  });
}
