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
import type { RevokeApple } from "./services/appleRevoke.ts";
import type { Enrich } from "./services/listingInsights.ts";
import type { Membership } from "./services/membership.ts";
import type { Catalog } from "./services/shopifyCatalog.ts";
import type { Trends } from "./services/trends.ts";
import type { TryOn } from "./services/tryOnImage.ts";
import type { UserData } from "./services/userData.ts";

declare module "fastify" {
  interface FastifyRequest {
    /** The signed-in Supabase user, or null on the routes that work logged out. */
    userId: string | null;
    /** That user is the silent anonymous sign-in, not Apple/Google. */
    anonymous: boolean;
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
  /** Anonymous Supabase logins count as signed in (ALLOW_ANONYMOUS). Off unless set. */
  allowAnonymous?: boolean;
  /** Revokes a deleted account's Sign in with Apple token; skipped without it. */
  revokeApple?: RevokeApple;
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
  /** Per-IP budget for those images across anonymous logins, since a new anonymous login is free. */
  anonymousTryOnGate?: Gate;
  /** Per-user budget for POST /events. */
  eventsGate?: Gate;
  /** Who has a paid membership (RevenueCat); the catalog, feed and try-on images are for members. Everyone gets in without it. */
  membership?: Membership;
  /** Proxy addresses (comma-separated IPs/CIDRs) whose X-Forwarded-For is believed, so req.ip is the client, not the proxy. */
  trustProxy?: string;
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
    trustProxy: deps.trustProxy,
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
  app.decorateRequest("anonymous", false);
  let proxyChecked = false;
  app.addHook("onRequest", async (req, reply) => {
    if (!proxyChecked && req.headers["x-forwarded-for"]) {
      proxyChecked = true;
      // Once per process, so a deploy shows whether TRUST_PROXY matches the host's proxy. Only the address's network half is logged.
      const proxy = req.socket.remoteAddress ?? "";
      const network = proxy.includes(".") ? proxy.split(".").slice(0, 2).join(".") : proxy.split(":").slice(0, 3).join(":");
      req.log.info({ proxyTrusted: req.ip !== proxy, proxyNetwork: network }, "proxy_check");
    }
    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";
    const user = token ? await deps.verify(token) : null;
    if (user && (!user.anonymous || deps.allowAnonymous)) [req.userId, req.anonymous] = [user.id, user.anonymous];
    if (!req.userId && !LOGGED_OUT_ROUTES.has(`${req.method} ${req.routeOptions.url}`)) return reply.code(401).send({ error: "unauthorized" });
    // Sign-up, backups and selfie analysis come before the paywall; what costs us per request comes after it.
    if (deps.membership && req.userId && req.routeOptions.url?.startsWith("/catalog/")) {
      const member = await deps.membership(req.userId);
      if (member === false) return reply.code(402).send({ error: "membership_required" });
      if (member === null) req.log.warn("membership_unavailable"); // let them in: a store outage shouldn't lock payers out
    }
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
