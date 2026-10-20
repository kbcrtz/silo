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
import { TOKEN, verify } from "./fixtures/auth.ts";

const rules = loadRules(JSON.parse(readFileSync(new URL("../rules/color-analysis.v1.json", import.meta.url), "utf8")));
const SECRET = "test-secret-0123456789";

test("the fixed template puts only the selected piece on a bare mannequin, for every kind of item", () => {
  for (const category of ["top", "bottom", "outerwear", "dress"] as const) {
    const prompt = tryOnPrompt({ category, department: "mens", cut: "relaxed fit, hip length, short sleeves" });
    assert.match(prompt, /wears ONLY the/);
    assert.match(prompt, /bare/);
    assert.match(prompt, /no shoes/);
    assert.match(prompt, /pure white \(#FFFFFF\) background/); // blends into the app's white card
    assert.doesNotMatch(prompt, /chinos|t-shirt|sneakers/);
  }
  assert.match(tryOnPrompt({ category: "top", department: "mens", cut: "relaxed fit" }), /male dress-form[\s\S]*relaxed fit/);
  assert.match(tryOnPrompt({ category: "dress", department: "womens" }), /female dress-form/);
  assert.match(tryOnPrompt({ category: "bottom", department: "mens" }), /ONLY the bottoms/);
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
  const asked: unknown[] = [];
  const catalog: Catalog = {
    search: async () => ({ products: [], cursor: null }),
    getProduct: async (_id, selected) => (asked.push(selected), opts.product === undefined ? productDetail : opts.product),
  };
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
    verify: async (token) => (token === "other-token" ? "0b0b0b0b-1c1c-4d2d-8e3e-4f4f4f4f4f4f" : verify(token)),
    gate: createGate({ windowMs: 60_000, max: 100, concurrency: 4 }),
    enrich,
    tryOn,
    tryOnGate: opts.gate ?? createGate({ windowMs: 60_000, max: 100, concurrency: 4 }),
  });
  const get = (url: string, token = TOKEN) => app.inject({ method: "GET", url, headers: { authorization: `Bearer ${token}` } });
  return { get, generated, saved, fetched, logs, asked };
}

const url = (dept = "mens") => `/catalog/tryon-image?id=${encodeURIComponent(productDetail.id)}&shopFor=${dept}`;

test("generates from the store photo with the template, then serves the saved image", async () => {
  const { get, generated, saved, fetched } = setup();
  const first = await get(url());
  assert.equal(first.statusCode, 200);
  assert.equal(first.headers["content-type"], "image/jpeg");
  assert.equal(first.rawPayload.toString(), "generated-jpeg");
  assert.equal(generated.length, 1);
  assert.match(generated[0].prompt, /ONLY the bottoms/); // the top half stays bare
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

test("past the per-user budget, no image is generated; other users keep theirs", async () => {
  const { get, generated } = setup({ gate: createGate({ windowMs: 60_000, max: 1, concurrency: 4 }) });
  await get(url("mens"));
  const res = await get(url("womens"));
  assert.equal(res.statusCode, 429);
  assert.deepEqual(res.json(), { error: "rate_limited" });
  assert.equal(generated.length, 1);
  assert.equal((await get(url("both"), "other-token")).statusCode, 200);
});

test("unknown products, shoes and missing photos are explained, not generated", async () => {
  assert.deepEqual((await setup({ product: null }).get(url())).json(), { error: "product_not_found" });
  assert.deepEqual((await setup({ insight: insight({ clothing: false }) }).get(url())).json(), { error: "not_clothing" });
  const noPhoto = { ...productDetail, media: [] };
  assert.deepEqual((await setup({ product: noPhoto }).get(url())).json(), { error: "no_photo" });
  assert.equal((await setup().get("/catalog/tryon-image?id=nope")).statusCode, 400);
});

test("the photo is the color the shopper saw: the variant's color goes to Shopify and into the saved key", async () => {
  const { get, generated, asked } = setup();
  const pick = (selected: unknown) => `${url()}&selected=${encodeURIComponent(JSON.stringify(selected))}`;
  await get(pick([{ name: "Color", label: "Space Black" }, { name: "Size", label: "M" }]));
  assert.deepEqual(asked[0], [{ name: "Color", label: "Space Black" }], "only the color option is sent; size doesn't change the photo");
  await get(pick([{ name: "Color", label: "Space Black" }, { name: "Size", label: "L" }]));
  assert.equal(generated.length, 1, "another size of the same color reuses the image");
  await get(pick([{ name: "Color", label: "Olive Green" }]));
  assert.equal(generated.length, 2, "another color gets its own image");
  await get(url());
  assert.equal(asked.at(-1), undefined, "without a color, Shopify picks the default as before");
  assert.equal((await get(`${url()}&selected=nope`)).statusCode, 400);
});
