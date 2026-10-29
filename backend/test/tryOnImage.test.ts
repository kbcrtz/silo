import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Writable } from "node:stream";
import { test } from "node:test";
import { loadRules } from "../src/analysis/evaluate.ts";
import { buildApp } from "../src/app.ts";
import { createGate, type Gate } from "../src/guard.ts";
import type { Enrich, Insight } from "../src/services/listingInsights.ts";
import type { Catalog } from "../src/services/shopifyCatalog.ts";
import sharp from "sharp";
import { bodyWords, createTryOn, fitPrompt, guideImage, memoryStore, photoUrlAllowed, tryOnPrompt, whiteBackground, type Guide, type TryOn } from "../src/services/tryOnImage.ts";
import { productDetail } from "./fixtures/shopify.ts";
import { ANON_TOKEN, TOKEN, verify } from "./fixtures/auth.ts";

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

test("with a body guide, the body comes from the diagram and the words, the garment's look from the photo", () => {
  const prompt = tryOnPrompt({ category: "dress", department: "womens", cut: "fitted fit", title: 'Kallan "Knit" Dress', build: "a plus-size body" });
  assert.match(prompt, /^Image 1 is a body diagram/);
  assert.match(prompt, /one specific person's body, a plus-size body/);
  assert.match(prompt, /Image 2 is a store photo of a product \("Kallan Knit Dress"\)/); // quotes stripped from the listing title
  assert.match(prompt, /neckline[\s\S]*of its photo/);
  assert.match(prompt, /Never copy the diagram's flat style or its blue color/);
  assert.match(prompt, /pure white \(#FFFFFF\) background/);
  assert.doesNotMatch(prompt, /fitted fit/, "the photo sets the cut, not the listing reader's guess");
});

test("a fit prompt names each photo by its listing title, after the body diagram, with the jacket worn over the rest", () => {
  const prompt = fitPrompt({
    pieces: [
      { category: "top", title: "Striped Tee" },
      { category: "bottom", title: 'Wide "Leg" Trouser' },
      { category: "outerwear", title: "Denim Jacket" },
    ],
    department: "womens",
    build: "an average body",
  });
  assert.match(prompt, /^Image 1 is a body diagram[\s\S]*an average body/);
  assert.match(prompt, /image 2 is the top \("Striped Tee"\), image 3 is the bottoms \("Wide Leg Trouser"\), image 4 is the jacket or coat \("Denim Jacket"\)/);
  assert.match(prompt, /the jacket or coat from image 4, worn open over the top/);
  assert.match(prompt, /female dress-form/);
  assert.match(prompt, /no shoes/);
  assert.match(fitPrompt({ pieces: [{ category: "dress", title: "Midi" }, { category: "outerwear", title: "Coat" }], department: "womens", build: "x" }), /worn open over the dress/);
  assert.doesNotMatch(fitPrompt({ pieces: [{ category: "bottom", title: "Chino" }, { category: "outerwear", title: "Coat" }], department: "mens", build: "x" }), /worn open/, "no top to wear it over");
});

test("an answer without an image is retried once, with the body diagram first", async () => {
  const jpeg = await sharp({ create: { width: 30, height: 40, channels: 3, background: "#eee" } }).jpeg().toBuffer();
  const answers = [{ candidates: [{ content: { parts: [] } }] }, { candidates: [{ content: { parts: [{ inlineData: { data: jpeg.toString("base64") } }] } }] }];
  const requests: any[] = [];
  const tryOn = createTryOn({ generateContent: async (r) => (requests.push(r), answers.shift() ?? answers[0]), model: "m", timeoutMs: 1000, fetch, store: memoryStore() });
  const photo = { data: Buffer.from("photo"), mimeType: "image/jpeg" };
  const image = await tryOn.generate([photo], "prompt", Buffer.from("guide"));
  assert.equal((await sharp(image).metadata()).format, "jpeg");
  assert.equal(requests.length, 2);
  assert.deepEqual(requests[0].contents[0].parts.map((p: any) => p.inlineData?.mimeType ?? "text"), ["image/png", "image/jpeg", "text"]);
  const never = createTryOn({ generateContent: async () => ({ candidates: [] }), model: "m", timeoutMs: 1000, fetch, store: memoryStore() });
  await assert.rejects(never.generate([photo], "prompt"), /gemini_invalid_output/);
});

/** A body (head, then everything below it) in cm: `w` wide, `h` tall. */
const box = (x: number, y: number, w: number, h: number): [number, number][] => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
const body = (w: number, h = 165): Guide => ({ body: [box(-10, 0, 20, 25), box(-w / 2, 25, w, h - 25)] });
const GUIDE = body(31);

test("the guide renders as a flat pale-blue body on white", async () => {
  const { data, info } = await sharp(await guideImage(GUIDE)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const at = (fx: number, fy: number) => {
    const i = (Math.round(fy * (info.height - 1)) * info.width + Math.round(fx * (info.width - 1))) * 3;
    return [data[i], data[i + 1], data[i + 2]];
  };
  assert.deepEqual(at(0.02, 0.5), [255, 255, 255], "white background");
  assert.deepEqual(at(0.5, 0.6), [196, 218, 244], "a filled body, so its width reads at a glance");
});

test("the body's build in words, from its area relative to its height", () => {
  assert.equal(bodyWords(body(22, 170)), "a slender body: narrow shoulders, a slim waist, slim hips and legs");
  assert.equal(bodyWords(body(31)), "an average body");
  assert.match(bodyWords(body(35)), /^a fuller, curvy body/);
  assert.match(bodyWords(body(40)), /^a plus-size, full-figured body/);
  assert.equal(bodyWords(body(30, 155)), "a petite, average body");
  assert.match(bodyWords(body(38, 185)), /^a tall, fuller/);
});

test("a gray studio backdrop turns pure white; the mannequin on it is kept", async () => {
  const W = 120, H = 160;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="100%" height="100%" fill="rgb(236,236,236)"/><rect x="40" y="20" width="40" height="120" fill="rgb(205,205,205)"/></svg>`;
  const out = await whiteBackground(await sharp(Buffer.from(svg)).jpeg().toBuffer());
  const { data } = await sharp(out).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const px = (x: number, y: number) => data[(y * W + x) * 3];
  assert.ok(px(5, 5) === 255 && px(110, 150) === 255, "backdrop is white");
  assert.ok(px(60, 80) < 215, "mannequin keeps its gray");
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
  department: "unisex",
  evidence: "relaxed trouser",
  ...patch,
});

function setup(opts: { product?: unknown; insight?: Insight | null; gate?: Gate; anonymousGate?: Gate } = {}) {
  const generated: { prompt: string; photo: Buffer; photos: number; guide?: Buffer }[] = [];
  const saved = new Map<string, Buffer>();
  const fetched: string[] = [];
  const tryOn: TryOn = {
    async fetchPhoto(url) {
      fetched.push(url);
      return { data: Buffer.from("photo"), mimeType: "image/jpeg" };
    },
    async generate(photos, prompt, guide) {
      generated.push({ prompt, photo: photos[0].data, photos: photos.length, guide });
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
  const enriched: unknown[] = [];
  const enrich: Enrich = async (facts) => (enriched.push(facts), facts.map(() => (opts.insight === undefined ? insight() : opts.insight)));
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
    verify: async (token) =>
      token === "other-token"
        ? { id: "0b0b0b0b-1c1c-4d2d-8e3e-4f4f4f4f4f4f", anonymous: false }
        : token === "anon-2"
          ? { id: "0c0c0c0c-1d1d-4e2e-8f3f-404040404040", anonymous: true }
          : verify(token),
    allowAnonymous: true,
    trustProxy: "100.64.0.0/10",
    gate: createGate({ windowMs: 60_000, max: 100, concurrency: 4 }),
    enrich,
    tryOn,
    tryOnGate: opts.gate ?? createGate({ windowMs: 60_000, max: 100, concurrency: 4 }),
    anonymousTryOnGate: opts.anonymousGate,
  });
  // `forwardedFor` arrives the way Railway's proxy (a 100.64.0.0/10 address) sends it: the client's address appended last.
  const get = (url: string, token = TOKEN, forwardedFor = "203.0.113.1") =>
    app.inject({ method: "GET", url, remoteAddress: "100.64.0.7", headers: { authorization: `Bearer ${token}`, "x-forwarded-for": forwardedFor } });
  return { get, generated, saved, fetched, logs, asked, enriched };
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

test("anonymous logins share one budget per network address, so new ones don't reset it", async () => {
  const { get, generated, logs } = setup({ anonymousGate: createGate({ windowMs: 60_000, max: 1, concurrency: 4 }) });
  assert.equal((await get(url("mens"), ANON_TOKEN, "198.51.100.5")).statusCode, 200);
  assert.equal((await get(url("womens"), "anon-2", "198.51.100.5")).statusCode, 429);
  // A client-written address in front of the one the proxy appended changes nothing.
  assert.equal((await get(url("womens"), "anon-2", "192.0.2.99, 198.51.100.5")).statusCode, 429);
  assert.equal((await get(url("womens"), "anon-2", "198.51.100.6")).statusCode, 200);
  assert.equal((await get(url("both"), TOKEN, "198.51.100.5")).statusCode, 200, "Apple/Google accounts keep their own budget");
  assert.equal(generated.length, 3);
  const checks = logs.filter((l) => l.msg === "proxy_check");
  assert.deepEqual([checks.length, checks[0].proxyTrusted, checks[0].proxyNetwork], [1, true, "100.64"]);
});

test("unknown products, shoes and missing photos are explained, not generated", async () => {
  assert.deepEqual((await setup({ product: null }).get(url())).json(), { error: "product_not_found" });
  assert.deepEqual((await setup({ insight: insight({ clothing: false }) }).get(url())).json(), { error: "not_clothing" });
  const noPhoto = { ...productDetail, media: [] };
  assert.deepEqual((await setup({ product: noPhoto }).get(url())).json(), { error: "no_photo" });
  assert.equal((await setup().get("/catalog/tryon-image?id=nope")).statusCode, 400);
});

const fitUrl = (fit: unknown, guide: unknown = GUIDE) =>
  `/catalog/tryon-image?shopFor=womens&fit=${encodeURIComponent(JSON.stringify(fit))}&guide=${encodeURIComponent(JSON.stringify(guide))}`;
const TEE = { id: "gid://shopify/p/tee1", category: "top", selected: [{ name: "Color", label: "Navy" }, { name: "Size", label: "M" }] };
const PANTS = { id: "gid://shopify/p/pants1", category: "bottom" };

test("a fit is one image of every piece on the shopper's body, saved for the same pieces in any order", async () => {
  const { get, generated, asked, fetched } = setup();
  const res = await get(fitUrl([PANTS, TEE]));
  assert.equal(res.statusCode, 200);
  assert.equal(generated.length, 1);
  assert.equal(generated[0].photos, 2);
  assert.equal(fetched.length, 2);
  assert.ok(generated[0].guide, "the body diagram goes first");
  assert.match(generated[0].prompt, /image 2 is the top[\s\S]*image 3 is the bottoms/, "inner layers first, whatever order the app sent");
  assert.deepEqual(asked, [[{ name: "Color", label: "Navy" }], undefined], "each piece's own color, no size");
  await get(fitUrl([TEE, { ...PANTS }]));
  assert.equal(generated.length, 1, "the same fit comes from storage");
  await get(fitUrl([TEE, { ...PANTS, selected: [{ name: "Color", label: "Khaki" }] }]));
  assert.equal(generated.length, 2, "another color of a piece is another fit");
});

test("a fit needs 2-3 different kinds of piece and the shopper's body", async () => {
  const { get, generated } = setup();
  const dress = { id: "gid://shopify/p/d1", category: "dress" };
  const coat = { id: "gid://shopify/p/c1", category: "outerwear" };
  assert.equal((await get(fitUrl([dress, coat]))).statusCode, 200);
  for (const bad of [[TEE], [TEE, { ...TEE, id: "gid://shopify/p/tee2" }], [dress, TEE], [TEE, PANTS, coat, dress]]) assert.equal((await get(fitUrl(bad))).statusCode, 400, JSON.stringify(bad));
  assert.equal((await get(fitUrl([TEE, PANTS]).replace(/&guide=[^&]*/, ""))).statusCode, 400, "no body, no fit");
  assert.equal((await get(`${fitUrl([TEE, PANTS])}&id=${encodeURIComponent(productDetail.id)}`)).statusCode, 400, "a fit or one product, not both");
  assert.equal(generated.length, 1);
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

test("a body guide goes to Gemini as a second image and keys the saved image per body", async () => {
  const { get, generated } = setup();
  const withGuide = (g: unknown) => `${url()}&guide=${encodeURIComponent(JSON.stringify(g))}`;
  assert.equal((await get(withGuide(GUIDE))).statusCode, 200);
  assert.match(generated[0].prompt, /body diagram[\s\S]*an average body[\s\S]*Image 2 is a store photo of a product \("/);
  assert.equal((await sharp(generated[0].guide!).metadata()).format, "png");
  await get(withGuide(GUIDE));
  assert.equal(generated.length, 1, "the same body reuses the image");
  await get(withGuide(body(40)));
  assert.equal(generated.length, 2, "another body gets its own image");
  await get(url());
  assert.equal(generated[2].guide, undefined, "older apps without a guide still get the generic image");
  assert.doesNotMatch(generated[2].prompt, /diagram/);
  for (const bad of ["nope", JSON.stringify({ body: [] }), JSON.stringify({ body: [GUIDE.body[0], [[0, 0]]] }), JSON.stringify({ body: [GUIDE.body[0], box(-25, 25, 5000, 140)] }), JSON.stringify({ ...GUIDE, extra: 1 }), JSON.stringify(body(30, 40)), JSON.stringify({ body: [GUIDE.body[0], box(-15, -5, 30, 5)] })])
    assert.equal((await get(`${url()}&guide=${encodeURIComponent(bad)}`)).statusCode, 400, bad);
});

test("with the app's category, the listing reader is skipped (it already read the listing for the feed)", async () => {
  const { get, generated, enriched } = setup();
  assert.equal((await get(`${url("womens")}&category=dress`)).statusCode, 200);
  assert.equal(enriched.length, 0, "no extra Gemini call before the image");
  assert.match(generated[0].prompt, /ONLY the dress/);
  await get(url("mens"));
  assert.equal(enriched.length, 1, "older apps without a category still get the reader");
  assert.equal((await get(`${url()}&category=shoes`)).statusCode, 400);
});
