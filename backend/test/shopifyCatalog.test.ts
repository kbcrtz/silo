import assert from "node:assert/strict";
import { test } from "node:test";
import { HttpError } from "../src/errors.ts";
import { createCatalog, type CatalogConfig } from "../src/services/shopifyCatalog.ts";
import { notFoundResult, productDetail, productResult, rpcError, searchResult, trouser } from "./fixtures/shopify.ts";

type Call = { url: string; init: RequestInit; body: any };

/** A fetch that replays `replies` in order and records what it was sent. */
function fakeFetch(replies: (Response | (() => Response | Promise<Response>))[]) {
  const calls: Call[] = [];
  const fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, init, body: JSON.parse(init.body as string) });
    const next = replies.shift();
    if (!next) throw new Error("unexpected extra call");
    return typeof next === "function" ? next() : next;
  }) as unknown as typeof globalThis.fetch;
  return { fetch, calls };
}
const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });

function setup(replies: Parameters<typeof fakeFetch>[0], overrides: Partial<CatalogConfig> = {}) {
  const { fetch, calls } = fakeFetch(replies);
  const waits: number[] = [];
  const catalog = createCatalog({
    fetch,
    endpoint: "https://catalog.test/api/ucp/mcp",
    profile: "https://profile.test/agent.json",
    country: "US",
    timeoutMs: 1000,
    sleep: async (ms) => void waits.push(ms),
    ...overrides,
  });
  return { catalog, calls, waits };
}

async function failsWith(p: Promise<unknown>, code: string, status: number, providerStatus?: number) {
  await assert.rejects(p, (e: unknown) => {
    assert.ok(e instanceof HttpError, String(e));
    assert.equal(e.code, code);
    assert.equal(e.status, status);
    if (providerStatus) assert.equal(e.providerStatus, providerStatus);
    return true;
  });
}

test("search sends one JSON-RPC search_catalog call with the agent profile and clothing filters", async () => {
  const { catalog, calls } = setup([json(searchResult([trouser]))]);
  const out = await catalog.search({ query: "women's olive trousers", limit: 20, cursor: "abc", priceMin: 2000, priceMax: 9000 });
  assert.equal(calls.length, 1);
  const { url, init, body } = calls[0];
  assert.equal(url, "https://catalog.test/api/ucp/mcp");
  assert.equal(init.method, "POST");
  assert.deepEqual(init.headers, { "content-type": "application/json", accept: "application/json, text/event-stream" });
  assert.equal(body.jsonrpc, "2.0");
  assert.equal(body.method, "tools/call");
  assert.equal(body.params.name, "search_catalog");
  const args = body.params.arguments;
  assert.equal(args.meta["ucp-agent"].profile, "https://profile.test/agent.json");
  assert.deepEqual(args.catalog, {
    query: "women's olive trousers",
    filters: { available: true, ships_to: { country: "US" }, categories: ["aa-1"], price: { min: 2000, max: 9000 } },
    context: { address_country: "US" },
    pagination: { limit: 20, cursor: "abc" },
  });
  assert.equal(out.products.length, 1);
  assert.equal(out.cursor, "c1");
});

test("a color family becomes Shopify's Color attribute filter", async () => {
  const { catalog, calls } = setup([json(searchResult([trouser]))]);
  await catalog.search({ query: "women's sage trousers", limit: 10, colors: ["Green"] });
  assert.deepEqual(calls[0].body.params.arguments.catalog.filters.attributes, [{ name: "Color", values: ["Green"] }]);
});

test("the last page has no cursor", async () => {
  const { catalog } = setup([json(searchResult([trouser], null))]);
  assert.equal((await catalog.search({ query: "x", limit: 10 })).cursor, null);
});

test("a 429 is retried once after a bounded backoff that honours Retry-After", async () => {
  const { catalog, calls, waits } = setup([json({}, 429, { "retry-after": "1" }), json(searchResult([trouser]))]);
  await catalog.search({ query: "x", limit: 10 });
  assert.equal(calls.length, 2);
  assert.deepEqual(waits, [1000]);
});

test("a long Retry-After is not waited out: it fails fast as rate limited", async () => {
  const { catalog, calls } = setup([json({}, 429, { "retry-after": "60" })]);
  await failsWith(catalog.search({ query: "x", limit: 10 }), "catalog_rate_limited", 503, 429);
  assert.equal(calls.length, 1);
});

test("repeated 429s give up after the retry", async () => {
  const { catalog, calls } = setup([json({}, 429), json({}, 429)]);
  await failsWith(catalog.search({ query: "x", limit: 10 }), "catalog_rate_limited", 503, 429);
  assert.equal(calls.length, 2);
});

test("server errors and network failures are retried once, then reported unavailable", async () => {
  const { catalog, calls } = setup([json({}, 503), json({}, 502)]);
  await failsWith(catalog.search({ query: "x", limit: 10 }), "catalog_unavailable", 502, 502);
  assert.equal(calls.length, 2);
  const net = setup([() => Promise.reject(new TypeError("fetch failed")), json(searchResult([trouser]))]);
  assert.equal((await net.catalog.search({ query: "x", limit: 10 })).products.length, 1);
});

test("a JSON-RPC error is not retried", async () => {
  const { catalog, calls } = setup([json(rpcError, 422)]);
  await failsWith(catalog.search({ query: "x", limit: 10 }), "catalog_unavailable", 502, 422);
  assert.equal(calls.length, 1);
});

test("a tool error or a malformed envelope is an invalid response, never an empty feed", async () => {
  const tool = setup([json({ jsonrpc: "2.0", id: 1, result: { isError: true, content: [{ type: "text", text: "bad" }] } })]);
  await failsWith(tool.catalog.search({ query: "x", limit: 10 }), "catalog_invalid_response", 502);
  const shape = setup([json({ jsonrpc: "2.0", id: 1, result: { structuredContent: { products: "nope" } } })]);
  await failsWith(shape.catalog.search({ query: "x", limit: 10 }), "catalog_invalid_response", 502);
  const text = setup([new Response("<html>oops</html>", { status: 200 })]);
  await failsWith(text.catalog.search({ query: "x", limit: 10 }), "catalog_invalid_response", 502);
});

test("a slow catalog times out without a retry", async () => {
  const hang = (signal: AbortSignal) =>
    new Promise<Response>((_, reject) => signal.addEventListener("abort", () => reject(signal.reason)));
  const calls: unknown[] = [];
  const catalog = createCatalog({
    fetch: ((_: string, init: RequestInit) => (calls.push(1), hang(init.signal!))) as typeof fetch,
    endpoint: "https://catalog.test",
    profile: "https://profile.test",
    country: "US",
    timeoutMs: 20,
  });
  await failsWith(catalog.search({ query: "x", limit: 10 }), "catalog_timeout", 504);
  assert.equal(calls.length, 1);
});

test("a caller that goes away cancels the upstream call", async () => {
  const controller = new AbortController();
  let seen: AbortSignal | undefined;
  const catalog = createCatalog({
    fetch: ((_: string, init: RequestInit) => {
      seen = init.signal!;
      controller.abort();
      return Promise.reject(init.signal!.reason);
    }) as typeof fetch,
    endpoint: "https://catalog.test",
    profile: "https://profile.test",
    country: "US",
    timeoutMs: 1000,
  });
  await failsWith(catalog.search({ query: "x", limit: 10 }, controller.signal), "client_closed", 499);
  assert.equal(seen?.aborted, true);
});

test("no more than two catalog calls are in flight at once", async () => {
  let inFlight = 0;
  let peak = 0;
  const catalog = createCatalog({
    fetch: (async () => {
      peak = Math.max(peak, ++inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight--;
      return json(searchResult([trouser]));
    }) as unknown as typeof fetch,
    endpoint: "https://catalog.test",
    profile: "https://profile.test",
    country: "US",
    timeoutMs: 1000,
  });
  await Promise.all([1, 2, 3, 4, 5].map(() => catalog.search({ query: "x", limit: 10 })));
  assert.equal(peak, 2);
});

test("getProduct asks for the selected options so the detail matches the tapped card", async () => {
  const { catalog, calls } = setup([json(productResult(productDetail))]);
  const product = await catalog.getProduct("gid://shopify/p/AAA111", [{ name: "Color", label: "Olive Green" }]);
  assert.equal((product as { id: string }).id, "gid://shopify/p/AAA111");
  const { params } = calls[0].body;
  assert.equal(params.name, "get_product");
  assert.deepEqual(params.arguments.catalog, {
    id: "gid://shopify/p/AAA111",
    selected: [{ name: "Color", label: "Olive Green" }],
    context: { address_country: "US" },
  });
});

test("an unknown product is null, not an error", async () => {
  const { catalog } = setup([json(notFoundResult)]);
  assert.equal(await catalog.getProduct("gid://shopify/p/nope"), null);
});
