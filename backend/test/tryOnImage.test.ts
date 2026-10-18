import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Writable } from "node:stream";
import { test } from "node:test";
import { loadRules } from "../src/analysis/evaluate.ts";
import { buildApp } from "../src/app.ts";
import { createGate, type Gate } from "../src/guard.ts";
import type { Enrich, Insight } from "../src/services/listingInsights.ts";
import type { Catalog } from "../src/services/shopifyCatalog.ts";
import { photoUrlAllowed, tryOnPrompt, type TryOn } from "../src/services/tryOnImage.ts";
import { productDetail } from "./fixtures/shopify.ts";

const rules = loadRules(JSON.parse(readFileSync(new URL("../rules/color-analysis.v1.json", import.meta.url), "utf8")));
const SECRET = "test-secret-0123456789";

test("the fixed template completes the outfit with a generic counterpart for each kind of item", () => {
  const top = tryOnPrompt({ category: "top", department: "mens", cut: "relaxed fit, hip length, short sleeves" });
  assert.match(top, /male dress-form/);
  assert.match(top, /chinos/);
  assert.match(top, /relaxed fit, hip length, short sleeves/);
  assert.match(top, /head to the feet/);
  const bottom = tryOnPrompt({ category: "bottom", department: "womens" });
  assert.match(bottom, /female dress-form/);
  assert.match(bottom, /white crew-neck t-shirt/);
  assert.doesNotMatch(bottom, /chinos/);
  const outer = tryOnPrompt({ category: "outerwear", department: "mens" });
  assert.match(outer, /t-shirt underneath/);
  assert.match(outer, /chinos/);
  const dress = tryOnPrompt({ category: "dress", department: "womens" });
  assert.doesNotMatch(dress, /chinos|t-shirt/);
});

test("only Shopify's image CDN is fetched", () => {
  assert.equal(photoUrlAllowed("https://cdn.shopify.com/s/files/1/0001/shirt.jpg"), true);
  assert.equal(photoUrlAllowed("http://cdn.shopify.com/s/files/1/shirt.jpg"), false);
  assert.equal(photoUrlAllowed("https://evil.example/shirt.jpg"), false);
  assert.equal(photoUrlAllowed("https://cdn.shopify.com.evil.example/x.jpg"), false);
  assert.equal(photoUrlAllowed("not a url"), false);
});

const insight = (patch: Partial<Insight> = {}): Insight => ({
  hex: "#6B7A3A",
  confidence: "high",
  cut: { category: "bottom", silhouette: "relaxed", length: "ankle" },
  pattern: "solid",
  accent: null,
  clothing: true,
  evidence: "relaxed trouser",
  ...patch,
});

function setup(opts: { product?: unknown; insight?: Insight | null; gate?: Gate } = {}) {
  const generated: { prompt: string; photo: Buffer }[] = [];
  const saved = new Map<string, Buffer>();
  const fetched: string[] = [];
  const tryOn: TryOn = {
    async fetchPhoto(url) {
      fetched.push(url);
      return { data: Buffer.from("photo"), mimeType: "image/jpeg" };
    },
    async generate(photo, prompt) {
      generated.push({ prompt, photo: photo.data });
      return Buffer.from("generated-jpeg");
    },
    store: {
      async get(key) {
        return saved.get(key) ?? null;
      },
      async put(key, image) {
        saved.set(key, image);
      },
    },
  };
  const catalog: Catalog = { search: async () => ({ products: [], cursor: null }), getProduct: async () => (opts.product === undefined ? productDetail : opts.product) };
  const enrich: Enrich = async (facts) => facts.map(() => (opts.insight === undefined ? insight() : opts.insight));
  const logs: any[] = [];
  const stream = new Writable({
    write(chunk, _enc, done) {
      for (const line of String(chunk).split("\n").filter(Boolean)) logs.push(JSON.parse(line));
      done();
    },
  });
  const app = buildApp({
    rules,
    model: "m",
    logger: { level: "info", stream },
    locate: async () => assert.fail("no Gemini"),
    catalog,
    secret: SECRET,
    gate: createGate({ windowMs: 60_000, max: 100, concurrency: 4 }),
    enrich,
    tryOn,
    tryOnGate: opts.gate ?? createGate({ windowMs: 60_000, max: 100, concurrency: 4 }),
  });
  const get = (url: string) => app.inject({ method: "GET", url, headers: { authorization: `Bearer ${SECRET}` } });
  return { get, generated, saved, fetched, logs };
}

const url = (dept = "mens") => `/catalog/tryon-image?id=${encodeURIComponent(productDetail.id)}&shopFor=${dept}`;

test("generates from the store photo with the template, then serves the saved image", async () => {
  const { get, generated, saved, fetched } = setup();
  const first = await get(url());
  assert.equal(first.statusCode, 200);
  assert.equal(first.headers["content-type"], "image/jpeg");
  assert.equal(first.rawPayload.toString(), "generated-jpeg");
  assert.equal(generated.length, 1);
  assert.match(generated[0].prompt, /white crew-neck t-shirt/); // a bottom gets a generic top
  assert.match(generated[0].prompt, /relaxed fit/);
  assert.match(fetched[0], /^https:\/\/cdn\.shopify\.com\//);
  assert.equal(saved.size, 1);
  const again = await get(url());
  assert.equal(again.rawPayload.toString(), "generated-jpeg");
  assert.equal(generated.length, 1, "the second view comes from storage");
});

test("each department gets its own image", async () => {
  const { get, generated } = setup();
  await get(url("mens"));
  await get(url("womens"));
  assert.equal(generated.length, 2);
  assert.match(generated[1].prompt, /female dress-form/);
});

test("past the per-device budget, no image is generated", async () => {
  const { get, generated } = setup({ gate: createGate({ windowMs: 60_000, max: 1, concurrency: 4 }) });
  await get(url("mens"));
  const res = await get(url("womens"));
  assert.equal(res.statusCode, 429);
  assert.deepEqual(res.json(), { error: "rate_limited" });
  assert.equal(generated.length, 1);
});

test("unknown products, shoes and missing photos are explained, not generated", async () => {
  assert.deepEqual((await setup({ product: null }).get(url())).json(), { error: "product_not_found" });
  assert.deepEqual((await setup({ insight: insight({ clothing: false }) }).get(url())).json(), { error: "not_clothing" });
  const noPhoto = { ...productDetail, media: [] };
  assert.deepEqual((await setup({ product: noPhoto }).get(url())).json(), { error: "no_photo" });
  assert.equal((await setup().get("/catalog/tryon-image?id=nope")).statusCode, 400);
});
