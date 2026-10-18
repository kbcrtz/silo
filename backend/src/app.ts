import { randomUUID } from "node:crypto";
import multipart from "@fastify/multipart";
import Fastify, { type FastifyServerOptions } from "fastify";
import type { Rules, Warnings } from "./analysis/evaluate.ts";
import type { LocatedRegions } from "./analysis/regions.ts";
import { colorAnalysisRoute } from "./routes/colorAnalysis.ts";

/** Finds facial regions in the model-sized JPEG (Gemini in production, a fake in tests). */
export type Locate = (jpeg: Buffer) => Promise<{ regions: LocatedRegions; warnings: Warnings }>;

export function buildApp(deps: { rules: Rules; locate: Locate; model: string; logger: FastifyServerOptions["logger"] }) {
  const app = Fastify({
    logger: deps.logger,
    genReqId: () => randomUUID(),
    requestIdHeader: false, // never trust a client-supplied id
  });
  app.addHook("onSend", async (req, reply) => {
    reply.header("x-request-id", req.id);
  });
  app.register(multipart);
  app.register(colorAnalysisRoute, deps);
  return app;
}
