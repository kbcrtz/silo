import { randomUUID } from "node:crypto";
import multipart from "@fastify/multipart";
import Fastify, { type FastifyServerOptions } from "fastify";
import type { Rules, Warnings } from "./analysis/evaluate.ts";
import type { LocatedRegions } from "./analysis/regions.ts";
import type { Verify } from "./auth.ts";
import type { Gate } from "./guard.ts";
import { catalogRoute } from "./routes/catalog.ts";
import { colorAnalysisRoute } from "./routes/colorAnalysis.ts";
import { meRoute } from "./routes/me.ts";
import { tryOnImageRoute } from "./routes/tryOnImage.ts";
import type { DeleteAccount } from "./services/account.ts";
import type { Enrich } from "./services/listingInsights.ts";
import type { Catalog } from "./services/shopifyCatalog.ts";
import type { Trends } from "./services/trends.ts";
import type { TryOn } from "./services/tryOnImage.ts";
import type { UserData } from "./services/userData.ts";

declare module "fastify" {
  interface FastifyRequest {
    /** The signed-in Supabase user, or null on the routes that work logged out. */
    userId: string | null;
  }
}

/** Onboarding runs logged out, so selfie analysis is the one route that works without a login. */
const LOGGED_OUT_ROUTES = new Set(["POST /color-analysis"]);

/** Finds facial regions in the model-sized JPEG (Gemini in production, a fake in tests). */
export type Locate = (jpeg: Buffer) => Promise<{ regions: LocatedRegions; warnings: Warnings }>;

export function buildApp(deps: {
  rules: Rules;
  locate: Locate;
  model: string;
  logger: FastifyServerOptions["logger"];
  catalog: Catalog;
  /** Signs feed cursors so the server only resumes its own. */
  secret: string;
  /** Checks a Supabase login token; requests without a valid one never reach Gemini, Shopify or user data. */
  verify: Verify;
  /** Deletes the signed-in user's account (DELETE /me); answers 503 without it. */
  deleteAccount?: DeleteAccount;
  /** Caps color-analysis: per-IP window and how many Gemini calls run at once. */
  gate: Gate;
  /** Estimates feed products' color and cut from listing text; the feed works without it. */
  enrich?: Enrich;
  /** Per-IP budget for those Gemini estimates; pages past it load without them. */
  estimateGate?: Gate;
  /** The signed-in user's data in Postgres; /me answers 503 without it. */
  userData?: UserData;
  /** Season popularity from app events; the feed works without it. */
  trends?: Trends;
  /** AI try-on images from store photos; /catalog/tryon-image answers 503 without it. */
  tryOn?: TryOn;
  /** Per-user budget for generating those images. */
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
  app.decorateRequest("userId", null);
  app.addHook("onRequest", async (req, reply) => {
    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";
    req.userId = token ? await deps.verify(token) : null;
    if (!req.userId && !LOGGED_OUT_ROUTES.has(`${req.method} ${req.routeOptions.url}`)) return reply.code(401).send({ error: "unauthorized" });
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
