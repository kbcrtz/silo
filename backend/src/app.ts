import { randomUUID } from "node:crypto";
import multipart from "@fastify/multipart";
import Fastify, { type FastifyServerOptions } from "fastify";
import type { Rules, Warnings } from "./analysis/evaluate.ts";
import type { LocatedRegions } from "./analysis/regions.ts";
import { catalogRoute } from "./routes/catalog.ts";
import { colorAnalysisRoute } from "./routes/colorAnalysis.ts";
import type { Catalog } from "./services/shopifyCatalog.ts";

/** Finds facial regions in the model-sized JPEG (Gemini in production, a fake in tests). */
export type Locate = (jpeg: Buffer) => Promise<{ regions: LocatedRegions; warnings: Warnings }>;

export function buildApp(deps: { rules: Rules; locate: Locate; model: string; logger: FastifyServerOptions["logger"]; catalog: Catalog }) {
  // Request logs keep the path only: discover's query string carries palette colors and search text.
  const req = (r: { method: string; url: string }) => ({ method: r.method, url: r.url.split("?")[0] });
  const logger = deps.logger === true ? {} : deps.logger;
  const app = Fastify({
    logger: logger ? { ...logger, serializers: { ...logger.serializers, req } } : logger,
    genReqId: () => randomUUID(),
    requestIdHeader: false, // never trust a client-supplied id
  });
  app.addHook("onSend", async (req, reply) => {
    reply.header("x-request-id", req.id);
  });
  app.register(multipart);
  app.register(colorAnalysisRoute, deps);
  app.register(catalogRoute, deps);
  return app;
}
