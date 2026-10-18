import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import sharp from "sharp";
import { loadRules } from "../src/analysis/evaluate.ts";
import { buildApp, type Locate } from "../src/app.ts";
import { createGate } from "../src/guard.ts";
import type { Catalog } from "../src/services/shopifyCatalog.ts";

const SECRET = "test-secret-0123456789";
const rules = loadRules(JSON.parse(readFileSync(new URL("../rules/color-analysis.v1.json", import.meta.url), "utf8")));
const found: Locate = async () => ({
  regions: { face: [100, 100, 900, 900], skin: [400, 300, 600, 500], lips: [700, 400, 800, 600], hair: [100, 200, 250, 800], iris: [350, 350, 400, 420] },
  warnings: {
    lipMakeup: false,
    colorCast: false,
    beautyFilter: false,
    occlusion: false,
    unevenLighting: false,
    overexposed: false,
    underexposed: false,
    blur: false,
    unreliableRegions: false,
  },
});

function catalog(): Catalog {
  return {
    async search() {
      return { products: [], cursor: null };
    },
    async getProduct() {
      return null;
    },
  };
}

function app(gate = createGate({ windowMs: 60_000, max: 100, concurrency: 4 })) {
  return buildApp({ rules, model: "m", logger: false, catalog: catalog(), locate: found, secret: SECRET, gate });
}

async function jpeg() {
  return sharp({ create: { width: 300, height: 300, channels: 3, background: { r: 200, g: 160, b: 140 } } })
    .jpeg()
    .toBuffer();
}

async function selfie(headers: Record<string, string> = {}) {
  const form = new FormData();
  form.append("selfie", new Blob([new Uint8Array(await jpeg())], { type: "image/jpeg" }), "selfie.jpg");
  const req = new Request("http://local/", { method: "POST", body: form });
  return {
    method: "POST" as const,
    url: "/color-analysis",
    payload: Buffer.from(await req.arrayBuffer()),
    headers: { "content-type": req.headers.get("content-type")!, authorization: `Bearer ${SECRET}`, ...headers },
  };
}

test("a request without the bearer token is rejected before any work", async () => {
  const res = await app().inject({ method: "GET", url: "/catalog/discover?category=tops" });
  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.json(), { error: "unauthorized" });
});

test("a wrong bearer token is rejected", async () => {
  const res = await app().inject({
    method: "GET",
    url: "/catalog/discover?category=tops",
    headers: { authorization: "Bearer nope-nope-nope" },
  });
  assert.equal(res.statusCode, 401);
});

test("a cursor that was not signed by this server is rejected", async () => {
  const body = Buffer.from(JSON.stringify({ p: 0, c: { 0: "next:jeans" } })).toString("base64url");
  const forged = `${body}.${createHmac("sha256", "other-secret-0123456789").update(body).digest("base64url")}`;
  const res = await app().inject({
    method: "GET",
    url: `/catalog/discover?category=jeans&cursor=${encodeURIComponent(forged)}`,
    headers: { authorization: `Bearer ${SECRET}` },
  });
  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.json(), { error: "invalid_cursor" });
});

test("color analysis past the per-client cap is 429 and does not call Gemini again", async () => {
  let calls = 0;
  const limited = buildApp({
    rules,
    model: "m",
    logger: false,
    catalog: catalog(),
    locate: async (jpeg) => (calls++, found(jpeg)),
    secret: SECRET,
    gate: createGate({ windowMs: 60_000, max: 1, concurrency: 4 }),
  });
  assert.equal((await limited.inject(await selfie())).statusCode, 200);
  const again = await limited.inject(await selfie());
  assert.equal(again.statusCode, 429);
  assert.deepEqual(again.json(), { error: "rate_limited" });
  assert.equal(calls, 1);
});

test("a second color analysis while one is running is 503", async () => {
  let release!: () => void;
  const blocked = new Promise<void>((resolve) => (release = resolve));
  let calls = 0;
  const limited = buildApp({
    rules,
    model: "m",
    logger: false,
    catalog: catalog(),
    locate: async (jpeg) => {
      calls++;
      await blocked;
      return found(jpeg);
    },
    secret: SECRET,
    gate: createGate({ windowMs: 60_000, max: 10, concurrency: 1 }),
  });
  const first = limited.inject(await selfie());
  await new Promise((resolve) => setTimeout(resolve, 50));
  const second = await limited.inject(await selfie());
  assert.equal(second.statusCode, 503);
  assert.deepEqual(second.json(), { error: "busy" });
  release();
  assert.equal((await first).statusCode, 200);
  assert.equal(calls, 1);
});
