import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { HttpError } from "../errors.ts";
import type { Enrich } from "../services/listingInsights.ts";
import type { Catalog } from "../services/shopifyCatalog.ts";
import { listingFacts, normalizeProduct, type CatalogProduct } from "./normalize.ts";
import { buildQueryPlan, seededRandom, shuffle, type DiscoverParams } from "./query.ts";

export const PAGE_SIZE = 20;
/** Big merchants list one style in many colors; past this they crowd out everyone else. */
const PER_MERCHANT = 2;
/** For You searches per page; each fills half the page. */
const PER_PAGE = 2;

/**
 * Where a feed is up to, handed to the app as an opaque cursor. `p` is the
 * position in the query plan (wrapping), `c` each query's own Shopify cursor:
 * null once that query has no more pages, `s` the seed the plan was built with.
 */
const Cursor = z.object({
  p: z.int().min(0).max(10_000),
  c: z.record(z.string(), z.string().max(2000).nullable()),
  s: z.int().min(0).max(2 ** 31 - 1).optional(),
});
type Cursor = z.infer<typeof Cursor>;

function mac(body: string, secret: string) {
  return createHmac("sha256", secret).update(body).digest("base64url");
}

/** `body.sig`. A cursor is only resumed when this server signed it with the current secret. */
const encode = (c: Cursor, secret: string) => {
  const body = Buffer.from(JSON.stringify(c)).toString("base64url");
  return `${body}.${mac(body, secret)}`;
};

function decode(raw: string, secret: string): Cursor {
  const dot = raw.lastIndexOf(".");
  if (dot <= 0) throw new HttpError("invalid_cursor", 400);
  const body = raw.slice(0, dot);
  const sig = Buffer.from(raw.slice(dot + 1));
  const expected = Buffer.from(mac(body, secret));
  if (sig.length !== expected.length || !timingSafeEqual(sig, expected)) throw new HttpError("invalid_cursor", 400);
  try {
    return Cursor.parse(JSON.parse(Buffer.from(body, "base64url").toString("utf8")));
  } catch {
    throw new HttpError("invalid_cursor", 400);
  }
}

export type DiscoverPage = {
  products: CatalogProduct[];
  cursor: string | null;
  upstreamCalls: number;
  dropped: number;
  /** How many products got an AI estimate, or why none did. */
  estimated?: number;
  estimateError?: string;
};

/**
 * One feed page. A category or search is a single 20-item search; For You
 * walks its query plan two queries at a time and, after the first pass,
 * resumes each query from its own cursor. Results are interleaved so one
 * query can't fill the page, deduplicated by product id, and capped per merchant.
 */
export async function discover(
  catalog: Catalog,
  params: DiscoverParams & { priceMin?: number; priceMax?: number },
  rawCursor: string | undefined,
  secret: string,
  signal?: AbortSignal,
  enrich?: Enrich,
): Promise<DiscoverPage> {
  const state: Cursor = rawCursor ? decode(rawCursor, secret) : { p: 0, c: {}, s: params.seed };
  // Later pages follow the plan the first page was built with, whatever seed comes with them.
  const plan = buildQueryPlan({ ...params, seed: state.s });
  const perQuery = plan.length > 1 ? PAGE_SIZE / PER_PAGE : PAGE_SIZE;
  const want = plan.length > 1 ? PER_PAGE : 1;

  // First pass: every query from its first page. After that: only queries with a cursor left.
  const picks: number[] = [];
  let pos = state.p;
  for (; picks.length < want && pos < state.p + plan.length; pos++) {
    const i = pos % plan.length;
    if (pos < plan.length || typeof state.c[i] === "string") picks.push(i);
  }

  const results = await Promise.all(
    picks.map((i) =>
      catalog.search(
        {
          query: plan[i].query,
          limit: perQuery,
          cursor: state.c[i] ?? undefined,
          priceMin: params.priceMin,
          priceMax: params.priceMax,
          ...(plan[i].color && { colors: [plan[i].color] }),
        },
        signal,
      ),
    ),
  );

  const next: Cursor = { p: pos, c: { ...state.c }, ...(state.s !== undefined && { s: state.s }) };
  picks.forEach((i, k) => (next.c[i] = results[k].cursor));
  const more = pos < plan.length || plan.some((_, i) => typeof next.c[i] === "string");

  const seen = new Set<string>();
  const perMerchant = new Map<string, number>();
  const products: CatalogProduct[] = [];
  const raws: unknown[] = [];
  let dropped = 0;
  const longest = Math.max(0, ...results.map((r) => r.products.length));
  for (let row = 0; row < longest; row++) {
    results.forEach((r, k) => {
      if (row >= r.products.length) return;
      const product = normalizeProduct(r.products[row], plan[picks[k]].category);
      if (!product) return void dropped++;
      const shown = perMerchant.get(product.merchant.name) ?? 0;
      if (seen.has(product.id) || shown >= PER_MERCHANT) return;
      seen.add(product.id);
      perMerchant.set(product.merchant.name, shown + 1);
      products.push(product);
      raws.push(r.products[row]);
    });
  }
  if (state.s !== undefined && products.length > 1) {
    // Mix the interleaved rows too, keeping each product next to its raw listing for the AI read.
    const order = shuffle([...products.keys()], seededRandom(state.s + state.p));
    products.splice(0, products.length, ...order.map((k) => products[k]));
    raws.splice(0, raws.length, ...order.map((k) => raws[k]));
  }
  const page: DiscoverPage = { products, cursor: picks.length && more ? encode(next, secret) : null, upstreamCalls: picks.length, dropped };
  if (!enrich || !products.length) return page;

  // Best effort: the page is complete without estimates, so a slow or failed call never blocks the feed.
  try {
    const insights = await enrich(raws.map((raw) => listingFacts(raw)!));
    insights.forEach((insight, k) => insight && (products[k].estimate = { ...insight, source: "ai" }));
    page.estimated = insights.filter(Boolean).length;
    // Shoes and bags tagged as clothing by Shopify can't go on the mannequin.
    page.products = products.filter((p) => p.estimate?.clothing !== false);
  } catch (e) {
    page.estimateError = e instanceof HttpError ? e.code : "estimate_failed";
  }
  return page;
}
