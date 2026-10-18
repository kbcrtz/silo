import { randomUUID } from "node:crypto";
import multipart from "@fastify/multipart";
import Fastify, { type FastifyServerOptions } from "fastify";
import type { Rules, Warnings } from "./analysis/evaluate.ts";
import type { LocatedRegions } from "./analysis/regions.ts";
import { bearerOk, type Gate } from "./guard.ts";
import { catalogRoute } from "./routes/catalog.ts";
import { colorAnalysisRoute } from "./routes/colorAnalysis.ts";
import { meRoute } from "./routes/me.ts";
import { tryOnImageRoute } from "./routes/tryOnImage.ts";
import type { Enrich } from "./services/listingInsights.ts";
import type { Catalog } from "./services/shopifyCatalog.ts";
import type { Trends } from "./services/trends.ts";
import type { TryOn } from "./services/tryOnImage.ts";
import type { UserData } from "./services/userData.ts";

/** Finds facial regions in the model-sized JPEG (Gemini in production, a fake in tests). */
export type Locate = (jpeg: Buffer) => Promise<{ regions: LocatedRegions; warnings: Warnings }>;

export function buildApp(deps: {
  rules: Rules;
  locate: Locate;
  model: string;
  logger: FastifyServerOptions["logger"];
  catalog: Catalog;
  /** Shared bearer token. Callers without it never reach Gemini or Shopify. */
  secret: string;
  /** Caps color-analysis: per-IP window and how many Gemini calls run at once. */
  gate: Gate;
  /** Estimates feed products' color and cut from listing text; the feed works without it. */
  enrich?: Enrich;
  /** Per-IP budget for those Gemini estimates; pages past it load without them. */
  estimateGate?: Gate;
  /** On-device data backed up to Postgres; /me answers 503 without it. */
  userData?: UserData;
  /** Season popularity from app events (Tiger Cloud); the feed works without it. */
  trends?: Trends;
  /** AI try-on images from store photos; /catalog/tryon-image answers 503 without it. */
  tryOn?: TryOn;
  /** Per-device budget for generating those images. */
  tryOnGate?: Gate;
}) {
  // Request logs keep the path only: discover's query string carries palette colors and search text.
  const req = (r: { method: string; url: string }) => ({ method: r.method, url: r.url.split("?")[0] });
  const logger = deps.logger === true ? {} : deps.logger;
  const app = Fastify({
    logger: logger ? { ...logger, serializers: { ...logger.serializers, req } } : logger,
    genReqId: () => randomUUID(),
    requestIdHeader: false, // never trust a client-supplied id
    // A stalled upload would otherwise hold a color-analysis slot until the socket dies.
    requestTimeout: 60_000,
  });
  // Fastify's own errors (bad JSON, body too large, unknown route) in the app's { error } shape.
  app.setErrorHandler((err: { statusCode?: number }, req, reply) => {
    const status = err.statusCode ?? 500;
    if (status >= 500) req.log.error({ errorName: (err as Error).name }, "unhandled");
    const code = status === 413 ? "too_large" : status === 415 ? "unsupported_media_type" : status < 500 ? "invalid_request" : "internal_error";
    return reply.code(status).send({ error: code });
  });
  app.setNotFoundHandler((_req, reply) => reply.code(404).send({ error: "not_found" }));
  app.addHook("onRequest", async (req, reply) => {
    if (!bearerOk(req.headers.authorization, deps.secret)) return reply.code(401).send({ error: "unauthorized" });
  });
  app.addHook("onSend", async (req, reply) => {
    reply.header("x-request-id", req.id);
  });
  app.register(multipart);
  app.register(colorAnalysisRoute, deps);
  app.register(catalogRoute, deps);
  app.register(meRoute, deps);
  app.register(tryOnImageRoute, deps);
  return app;
}
