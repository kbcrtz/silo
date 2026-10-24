import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import { discover } from "../catalog/discover.ts";
import { normalizeProduct } from "../catalog/normalize.ts";
import { CATEGORIES, STYLES } from "../catalog/query.ts";
import { HttpError } from "../errors.ts";
import type { Gate } from "../guard.ts";
import type { Enrich } from "../services/listingInsights.ts";
import type { Catalog } from "../services/shopifyCatalog.ts";
import { markPopular, type Trends } from "../services/trends.ts";

const hexList = z
  .string()
  .max(200)
  .transform((s) => s.split(",").filter(Boolean))
  .pipe(z.array(z.string().regex(/^#[0-9a-f]{6}$/i)).max(16));
const dollars = z.coerce.number().int().min(0).max(100_000).optional();

const DiscoverQuery = z.strictObject({
  category: z.enum(CATEGORIES).default("for-you"),
  q: z
    .string()
    .max(100)
    .transform((s) => s.trim() || undefined)
    .optional(),
  shopFor: z.enum(["womens", "mens", "both"]).default("both"),
  style: z.enum(STYLES).default("none"),
  palette: hexList.default([]),
  neutrals: hexList.default([]),
  priceMin: dollars,
  priceMax: dollars,
  /** A new random number per feed open or refresh; varies the searches. Later pages use the cursor's. */
  seed: z.coerce.number().int().min(0).max(2 ** 31 - 1).optional(),
  // Room for the HMAC suffix on the opaque cursor.
  cursor: z.string().max(4500).optional(),
  /** The shopper's season id, for "popular with your season". */
  season: z
    .string()
    .regex(/^[a-z-]{3,24}$/)
    .optional(),
});

const Selected = z.array(z.object({ name: z.string().max(100), label: z.string().max(100) })).max(10);
/** A query parameter holding JSON, checked against `schema`. */
export const jsonParam = <T extends z.ZodType>(max: number, schema: T) =>
  z
    .string()
    .max(max)
    .transform((s, ctx) => {
      try {
        return JSON.parse(s) as unknown;
      } catch {
        ctx.addIssue({ code: "custom", message: "not JSON" });
        return z.NEVER;
      }
    })
    .pipe(schema);
/** `selected=<JSON>`: a variant's options, e.g. [{"name":"Color","label":"Light Blue"}]. */
export const SelectedParam = jsonParam(2000, Selected);
const ProductQuery = z.strictObject({
  id: z.string().regex(/^gid:\/\/shopify\/p\/[A-Za-z0-9]+$/),
  selected: SelectedParam.optional(),
});

/** Aborts the upstream Shopify call when the app goes away mid-request. */
function clientSignal(reply: FastifyReply): AbortSignal {
  const controller = new AbortController();
  reply.raw.on("close", () => {
    if (!reply.raw.writableEnded) controller.abort();
  });
  return controller.signal;
}

const TRENDING_BUDGET_MS = 1_500;

const cents = (dollars?: number) => (dollars === undefined ? undefined : dollars * 100);

/**
 * GET /catalog/discover and GET /catalog/product: live Shopify Global Catalog
 * listings, normalized for the app. Nothing is cached or stored, per Shopify's
 * catalog rules.
 */
export async function catalogRoute(
  app: FastifyInstance,
  {
    catalog,
    secret,
    enrich,
    trends,
    estimateGate,
  }: { catalog: Catalog; secret: string; enrich?: Enrich; trends?: Trends; estimateGate?: Gate },
) {
  async function handle(route: string, req: { log: FastifyInstance["log"] }, reply: FastifyReply, run: (diag: Record<string, unknown>) => Promise<unknown>) {
    const started = performance.now();
    // Counts only: no queries, palette colors or search text, which describe the shopper.
    const diag: Record<string, unknown> = { route };
    try {
      return await run(diag);
    } catch (e) {
      const known = e instanceof HttpError ? e : null;
      if (!known) req.log.error({ errorName: (e as Error).name }, "catalog_unexpected");
      const err = known ?? new HttpError("internal_error", 500);
      diag.error = err.code;
      if (err.providerStatus) diag.providerStatus = err.providerStatus;
      return reply.code(err.status).send({ error: err.code });
    } finally {
      diag.durationMs = Math.round(performance.now() - started);
      req.log.info({ catalog: diag }, "catalog");
    }
  }

  app.get("/catalog/discover", (req, reply) =>
    handle("discover", req, reply, async (diag) => {
      const query = DiscoverQuery.safeParse(req.query);
      if (!query.success) throw new HttpError("invalid_request", 400);
      // Gemini estimates are billed per page; past the user's budget the page loads without them.
      const aiAllowed = Boolean(enrich) && (!estimateGate || estimateGate.tryEnter(req.userId ?? req.ip) === "ok");
      try {
        const { cursor, priceMin, priceMax, season, ...params } = query.data;
        diag.category = params.category;
        // Looked up alongside the Shopify search; slow (database down, pool busy) or failed just means no popular marks.
        const trending =
          season && trends
            ? Promise.race([trends.trending(season).catch(() => null), new Promise<null>((r) => setTimeout(r, TRENDING_BUDGET_MS, null))])
            : null;
        const page = await discover(
          catalog,
          { ...params, priceMin: cents(priceMin), priceMax: cents(priceMax) },
          cursor,
          secret,
          clientSignal(reply),
          aiAllowed ? enrich : undefined,
        );
        if (enrich && !aiAllowed) page.estimateError = "estimate_budget";
        const top = await trending;
        if (top) page.products = markPopular(page.products, top);
        diag.popular = page.products.filter((p) => p.popular).length;
        const { upstreamCalls, dropped, estimated, estimateError } = page;
        Object.assign(diag, { upstreamCalls, returned: page.products.length, dropped, estimated, estimateError });
        return { products: page.products, cursor: page.cursor, source: "shopify" };
      } finally {
        if (aiAllowed && estimateGate) estimateGate.leave();
      }
    }),
  );

  app.get("/catalog/product", (req, reply) =>
    handle("product", req, reply, async (diag) => {
      const query = ProductQuery.safeParse(req.query);
      if (!query.success) throw new HttpError("invalid_request", 400);
      diag.upstreamCalls = 1;
      const raw = await catalog.getProduct(query.data.id, query.data.selected, clientSignal(reply));
      const product = raw && normalizeProduct(raw, undefined, { detail: true });
      if (!product) throw new HttpError("product_not_found", 404);
      return { product };
    }),
  );
}
