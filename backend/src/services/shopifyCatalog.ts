import { z } from "zod";
import { HttpError } from "../errors.ts";

export type SearchInput = {
  query: string;
  limit: number;
  cursor?: string;
  /** Minor currency units, like Shopify's own price filter. */
  priceMin?: number;
  priceMax?: number;
  /** Shopify color families ("Green", "Brown"); matching listings come back on a variant in that color. */
  colors?: string[];
};
export type Choice = { name: string; label: string };

/** Shopify Global Catalog: raw products in, no caching (Shopify's catalog rules forbid it). */
export type Catalog = {
  search(input: SearchInput, signal?: AbortSignal): Promise<{ products: unknown[]; cursor: string | null }>;
  /** Null when the id doesn't resolve. */
  getProduct(id: string, selected?: Choice[], signal?: AbortSignal): Promise<unknown | null>;
};

export type CatalogConfig = {
  fetch: typeof fetch;
  endpoint: string;
  /** UCP agent profile URL; anonymous access needs only this. */
  profile: string;
  /** Ships-to and pricing country, ISO 3166-1 alpha-2. */
  country: string;
  timeoutMs: number;
  sleep?: (ms: number) => Promise<void>;
};

/** Shopify Standard Product Taxonomy "Apparel & Accessories > Clothing"; checked against the live API. */
const CLOTHING = "aa-1";
/** Anonymous access shares low rate limits, so this server never has more than two calls open. */
const MAX_IN_FLIGHT = 2;
/** One retry, and only if Shopify asks us to wait no longer than this. */
const MAX_RETRY_AFTER_MS = 3000;
const BACKOFF_MS = 500;

const Envelope = z.object({
  error: z.unknown().optional(),
  result: z.object({ isError: z.boolean().optional(), structuredContent: z.record(z.string(), z.unknown()).optional() }).optional(),
});
const SearchContent = z.object({
  products: z.array(z.unknown()).default([]),
  pagination: z.object({ has_next_page: z.boolean().optional(), cursor: z.string().optional() }).optional(),
});
const ProductContent = z.object({
  product: z.unknown().optional(),
  messages: z.array(z.object({ code: z.string().optional() })).optional(),
});

/** At most `max` calls run at once; the rest wait their turn. */
function limiter(max: number) {
  let active = 0;
  const waiting: (() => void)[] = [];
  return async <T>(fn: () => Promise<T>): Promise<T> => {
    if (active >= max) await new Promise<void>((resolve) => waiting.push(resolve));
    else active++;
    try {
      return await fn();
    } finally {
      // Hand the slot straight to the next caller so a newcomer can't jump in between.
      const next = waiting.shift();
      if (next) next();
      else active--;
    }
  };
}

class Retryable extends Error {
  readonly providerStatus: number | undefined;
  readonly retryAfterMs?: number;
  constructor(providerStatus: number | undefined, retryAfterMs?: number) {
    super("retryable");
    this.providerStatus = providerStatus;
    this.retryAfterMs = retryAfterMs;
  }
}

function retryAfter(res: Response): number | undefined {
  const header = res.headers.get("retry-after");
  if (!header?.trim()) return undefined; // Number(null) is 0, which would retry at once
  const seconds = Number(header);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : undefined;
}

export function createCatalog(cfg: CatalogConfig): Catalog {
  const sleep = cfg.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const gate = limiter(MAX_IN_FLIGHT);

  async function attempt(body: string, timeout: AbortSignal, signal?: AbortSignal): Promise<Record<string, unknown>> {
    let res: Response;
    let parsed: unknown;
    try {
      res = await cfg.fetch(cfg.endpoint, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
        body,
        signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      });
      if (res.status === 429) throw new Retryable(429, retryAfter(res));
      if (res.status >= 500) throw new Retryable(res.status);
      parsed = await res.json().catch((e) => {
        if (signal?.aborted || timeout.aborted) throw e; // a stalled body is a timeout, not bad JSON
        return undefined;
      });
    } catch (e) {
      if (signal?.aborted) throw new HttpError("client_closed", 499);
      if (timeout.aborted) throw new HttpError("catalog_timeout", 504);
      if (e instanceof Retryable) throw e;
      throw new Retryable(undefined); // network failure
    }
    const envelope = Envelope.safeParse(parsed);
    if (!res.ok || (envelope.success && envelope.data.error)) throw new HttpError("catalog_unavailable", 502, res.status);
    const content = envelope.success && !envelope.data.result?.isError ? envelope.data.result?.structuredContent : undefined;
    if (!content) throw new HttpError("catalog_invalid_response", 502);
    return content;
  }

  async function call(name: string, catalog: Record<string, unknown>, signal?: AbortSignal) {
    const body = JSON.stringify({
      jsonrpc: "2.0",
      method: "tools/call",
      id: 1,
      params: { name, arguments: { meta: { "ucp-agent": { profile: cfg.profile } }, catalog } },
    });
    // One clock for the whole call: time queued behind the limiter and retries count.
    const timeout = AbortSignal.timeout(cfg.timeoutMs);
    for (let tries = 1; ; tries++) {
      try {
        return await gate(() => attempt(body, timeout, signal));
      } catch (e) {
        if (!(e instanceof Retryable)) throw e;
        const tooLong = (e.retryAfterMs ?? 0) > MAX_RETRY_AFTER_MS;
        if (tries >= 2 || tooLong) {
          throw e.providerStatus === 429
            ? new HttpError("catalog_rate_limited", 503, 429)
            : new HttpError("catalog_unavailable", 502, e.providerStatus);
        }
        await sleep(e.retryAfterMs ?? BACKOFF_MS);
      }
    }
  }

  const context = { address_country: cfg.country };
  return {
    async search({ query, limit, cursor, priceMin, priceMax, colors }, signal) {
      const price = priceMin !== undefined || priceMax !== undefined ? { price: { min: priceMin, max: priceMax } } : {};
      const color = colors?.length ? { attributes: [{ name: "Color", values: colors }] } : {};
      const content = await call(
        "search_catalog",
        {
          query,
          filters: { available: true, ships_to: { country: cfg.country }, categories: [CLOTHING], ...price, ...color },
          context,
          pagination: { limit, ...(cursor && { cursor }) },
        },
        signal,
      );
      const parsed = SearchContent.safeParse(content);
      if (!parsed.success) throw new HttpError("catalog_invalid_response", 502);
      const { products, pagination } = parsed.data;
      return { products, cursor: pagination?.has_next_page && pagination.cursor ? pagination.cursor : null };
    },

    async getProduct(id, selected, signal) {
      const content = await call("get_product", { id, ...(selected?.length && { selected }), context }, signal);
      const parsed = ProductContent.safeParse(content);
      if (!parsed.success) throw new HttpError("catalog_invalid_response", 502);
      if (parsed.data.product) return parsed.data.product;
      if (parsed.data.messages?.some((m) => m.code === "not_found")) return null;
      throw new HttpError("catalog_invalid_response", 502);
    },
  };
}
