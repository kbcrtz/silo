import { z } from "zod";
import { HttpError } from "../errors.ts";
import type { Catalog } from "../services/shopifyCatalog.ts";
import { normalizeProduct, type CatalogProduct } from "./normalize.ts";
import { buildQueryPlan, type DiscoverParams } from "./query.ts";

export const PAGE_SIZE = 20;
/** Big merchants list one style in many colors; past this they crowd out everyone else. */
const PER_MERCHANT = 2;
/** For You searches per page; each fills half the page. */
const PER_PAGE = 2;

/**
 * Where a feed is up to, handed to the app as an opaque cursor. `p` is the
 * position in the query plan (wrapping), `c` each query's own Shopify cursor:
 * null once that query has no more pages.
 */
const Cursor = z.object({ p: z.int().min(0).max(10_000), c: z.record(z.string(), z.string().max(2000).nullable()) });
type Cursor = z.infer<typeof Cursor>;

const encode = (c: Cursor) => Buffer.from(JSON.stringify(c)).toString("base64url");
function decode(raw: string): Cursor {
  try {
    return Cursor.parse(JSON.parse(Buffer.from(raw, "base64url").toString("utf8")));
  } catch {
    throw new HttpError("invalid_cursor", 400);
  }
}

export type DiscoverPage = { products: CatalogProduct[]; cursor: string | null; upstreamCalls: number; dropped: number };

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
  signal?: AbortSignal,
): Promise<DiscoverPage> {
  const plan = buildQueryPlan(params);
  const state = rawCursor ? decode(rawCursor) : { p: 0, c: {} };
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
        { query: plan[i].query, limit: perQuery, cursor: state.c[i] ?? undefined, priceMin: params.priceMin, priceMax: params.priceMax },
        signal,
      ),
    ),
  );

  const next: Cursor = { p: pos, c: { ...state.c } };
  picks.forEach((i, k) => (next.c[i] = results[k].cursor));
  const more = pos < plan.length || plan.some((_, i) => typeof next.c[i] === "string");

  const seen = new Set<string>();
  const perMerchant = new Map<string, number>();
  const products: CatalogProduct[] = [];
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
    });
  }
  return { products, cursor: picks.length && more ? encode(next) : null, upstreamCalls: picks.length, dropped };
}
