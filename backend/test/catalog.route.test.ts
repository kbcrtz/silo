import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Writable } from "node:stream";
import { test } from "node:test";
import { loadRules } from "../src/analysis/evaluate.ts";
import { buildApp } from "../src/app.ts";
import { HttpError } from "../src/errors.ts";
import type { Catalog, SearchInput } from "../src/services/shopifyCatalog.ts";
import { noUrl, productDetail, sweater, trouser } from "./fixtures/shopify.ts";

const rules = loadRules(JSON.parse(readFileSync(new URL("../rules/color-analysis.v1.json", import.meta.url), "utf8")));
const softAutumn = "palette=%23B07D62,%239CAF88,%23C9A66B,%237E8C6A&neutrals=%23EDE4D8,%235C5046";

/** A catalog that answers every search with `products` and a cursor named after the query. */
function setup(opts: { products?: unknown[]; fail?: HttpError; product?: unknown; lastPage?: boolean } = {}) {
  const searches: SearchInput[] = [];
  const lookups: { id: string; selected?: unknown }[] = [];
  const catalog: Catalog = {
    async search(input) {
      searches.push(input);
      if (opts.fail) throw opts.fail;
      return { products: opts.products ?? [trouser, sweater], cursor: opts.lastPage ? null : `next:${input.query}` };
    },
    async getProduct(id, selected) {
      lookups.push({ id, selected });
      if (opts.fail) throw opts.fail;
      return opts.product === undefined ? productDetail : opts.product;
    },
  };
  const logs: any[] = [];
  const stream = new Writable({
    write(chunk, _enc, done) {
      for (const line of String(chunk).split("\n").filter(Boolean)) logs.push(JSON.parse(line));
      done();
    },
  });
  const app = buildApp({ rules, model: "m", logger: { level: "info", stream }, locate: async () => assert.fail("no Gemini here"), catalog });
  const get = (url: string) => app.inject({ method: "GET", url });
  return { get, searches, lookups, logs };
}

test("a category page is one 20-item search, normalized and labeled as live Shopify data", async () => {
  const { get, searches } = setup({ products: [trouser, noUrl, sweater, trouser] });
  const res = await get("/catalog/discover?category=tops&shopFor=mens");
  assert.equal(res.statusCode, 200);
  assert.equal(searches.length, 1);
  assert.equal(searches[0].query, "men's tops");
  assert.equal(searches[0].limit, 20);
  const body = res.json();
  assert.equal(body.source, "shopify");
  // noUrl is dropped, the duplicate trouser is shown once.
  assert.deepEqual(body.products.map((p: any) => p.id), [trouser.id, sweater.id]);
  assert.equal(body.products[0].category, "tops");
  assert.equal(typeof body.cursor, "string");
});

test("one merchant fills at most two spots on a page", async () => {
  const sameShop = (n: number) => ({ ...trouser, id: `gid://shopify/p/SAME${n}` });
  const { get } = setup({ products: [sameShop(1), sameShop(2), sameShop(3), sweater] });
  const ids = (await get("/catalog/discover?category=tops")).json().products.map((p: any) => p.id);
  assert.deepEqual(ids, ["gid://shopify/p/SAME1", "gid://shopify/p/SAME2", sweater.id]);
});

test("the cursor continues the same search where it left off", async () => {
  const { get, searches } = setup();
  const first = (await get("/catalog/discover?category=jeans")).json();
  await get(`/catalog/discover?category=jeans&cursor=${encodeURIComponent(first.cursor)}`);
  assert.equal(searches[1].query, "jeans");
  assert.equal(searches[1].cursor, "next:jeans");
});

test("the last page returns a null cursor", async () => {
  const { get } = setup({ lastPage: true });
  assert.equal((await get("/catalog/discover?category=jeans")).json().cursor, null);
});

test("men's dresses is an empty page without a Shopify call", async () => {
  const { get, searches } = setup();
  const res = await get("/catalog/discover?category=dresses&shopFor=mens");
  assert.deepEqual(res.json(), { products: [], cursor: null, source: "shopify" });
  assert.equal(searches.length, 0);
});

test("For You makes two searches per page, interleaved and deduplicated", async () => {
  const { get, searches } = setup({ products: [trouser, sweater] });
  const res = await get(`/catalog/discover?category=for-you&shopFor=womens&${softAutumn}`);
  assert.equal(res.statusCode, 200);
  assert.equal(searches.length, 2);
  assert.ok(searches.every((s) => s.limit === 10 && s.cursor === undefined));
  assert.notEqual(searches[0].query, searches[1].query);
  assert.deepEqual(res.json().products.map((p: any) => p.id), [trouser.id, sweater.id]);
});

test("For You pages walk the query plan, then resume each query from its own cursor", async () => {
  const { get, searches } = setup();
  let cursor = "";
  const queries: string[][] = [];
  for (let page = 0; page < 6; page++) {
    const before = searches.length;
    const res = (await get(`/catalog/discover?shopFor=womens&style=minimal&${softAutumn}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`)).json();
    queries.push(searches.slice(before).map((s) => s.query));
    cursor = res.cursor;
  }
  const firstRound = queries.slice(0, 4).flat();
  assert.equal(new Set(firstRound).size, 8, "eight different queries before any repeats");
  assert.deepEqual(queries[4], firstRound.slice(0, 2));
  assert.deepEqual(searches.slice(8, 10).map((s) => s.cursor), firstRound.slice(0, 2).map((q) => `next:${q}`));
});

test("search text replaces For You with one direct search", async () => {
  const { get, searches } = setup();
  await get("/catalog/discover?q=linen%20shirt&shopFor=mens&priceMin=20&priceMax=90");
  assert.equal(searches.length, 1);
  assert.equal(searches[0].query, "men's linen shirt");
  assert.equal(searches[0].priceMin, 2000);
  assert.equal(searches[0].priceMax, 9000);
});

test("bad input is a 400 that never reaches Shopify", async () => {
  const { get, searches } = setup();
  for (const url of [
    "/catalog/discover?category=shoes",
    "/catalog/discover?shopFor=kids",
    "/catalog/discover?palette=red",
    "/catalog/discover?priceMin=-5",
    `/catalog/discover?q=${"x".repeat(200)}`,
  ]) {
    const res = await get(url);
    assert.equal(res.statusCode, 400, url);
    assert.deepEqual(res.json(), { error: "invalid_request" });
  }
  assert.deepEqual((await get("/catalog/discover?cursor=garbage")).json(), { error: "invalid_cursor" });
  assert.equal(searches.length, 0);
});

test("a Shopify failure is passed on as its own status and code", async () => {
  const { get, logs } = setup({ fail: new HttpError("catalog_rate_limited", 503, 429) });
  const res = await get("/catalog/discover?category=all");
  assert.equal(res.statusCode, 503);
  assert.deepEqual(res.json(), { error: "catalog_rate_limited" });
  const d = logs.find((l) => l.catalog)?.catalog;
  assert.equal(d.error, "catalog_rate_limited");
  assert.equal(d.providerStatus, 429);
});

test("logs count calls and products without logging queries or palette colors", async () => {
  const { get, logs } = setup({ products: [trouser, noUrl] });
  await get(`/catalog/discover?${softAutumn}`);
  const d = logs.find((l) => l.catalog)?.catalog;
  assert.equal(d.route, "discover");
  assert.equal(d.category, "for-you");
  assert.equal(d.upstreamCalls, 2);
  assert.equal(d.returned, 1);
  assert.equal(d.dropped, 2);
  assert.equal(typeof d.durationMs, "number");
  const all = JSON.stringify(logs);
  assert.ok(!all.includes("B07D62") && !all.includes("women's"), "log leaked palette or query");
});

test("product detail resolves the Shopify id with the card's selected options", async () => {
  const { get, lookups } = setup();
  const selected = JSON.stringify([{ name: "Color", label: "Olive Green" }]);
  const res = await get(`/catalog/product?id=${encodeURIComponent(trouser.id)}&selected=${encodeURIComponent(selected)}`);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(lookups, [{ id: trouser.id, selected: [{ name: "Color", label: "Olive Green" }] }]);
  const { product } = res.json();
  assert.equal(product.description, "Relaxed fit & drawstring waist.");
  assert.equal(product.variants.length, 2);
  assert.equal(product.url, trouser.variants[0].url);
});

test("an unknown or unlinkable product is a 404", async () => {
  assert.equal((await setup({ product: null }).get(`/catalog/product?id=${encodeURIComponent("gid://shopify/p/nope")}`)).statusCode, 404);
  const res = await setup({ product: noUrl }).get(`/catalog/product?id=${encodeURIComponent(noUrl.id)}`);
  assert.deepEqual(res.json(), { error: "product_not_found" });
});

test("product ids must be Shopify ids", async () => {
  const { get, lookups } = setup();
  for (const url of ["/catalog/product", "/catalog/product?id=https://evil.example/p", "/catalog/product?id=gid%3A%2F%2Fshopify%2Fp%2FA&selected=notjson"]) {
    assert.equal((await get(url)).statusCode, 400, url);
  }
  assert.equal(lookups.length, 0);
});
