import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import sharp from "sharp";
import { loadRules } from "../src/analysis/evaluate.ts";
import { buildApp, type Locate } from "../src/app.ts";
import { createGate } from "../src/guard.ts";
import type { Catalog } from "../src/services/shopifyCatalog.ts";
import { ANON_TOKEN, TOKEN, verify } from "./fixtures/auth.ts";

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

function app(gate = createGate({ windowMs: 60_000, max: 100, concurrency: 4 }), allowAnonymous?: boolean) {
  return buildApp({ rules, model: "m", logger: false, catalog: catalog(), locate: found, secret: SECRET,
    verify, gate, allowAnonymous });
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
    headers: { "content-type": req.headers.get("content-type")!, authorization: `Bearer ${TOKEN}`, ...headers },
  };
}

test("a request without a login token is rejected before any work", async () => {
  const res = await app().inject({ method: "GET", url: "/catalog/discover?category=tops" });
  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.json(), { error: "unauthorized" });
});

test("a token the verifier refuses is rejected", async () => {
  const res = await app().inject({
    method: "GET",
    url: "/catalog/discover?category=tops",
    headers: { authorization: "Bearer nope-nope-nope" },
  });
  assert.equal(res.statusCode, 401);
});

test("selfie analysis works before sign-in: onboarding runs logged out", async () => {
  const request = await selfie();
  const { authorization: _, ...noLogin } = request.headers;
  const res = await app().inject({ ...request, headers: noLogin });
  assert.equal(res.statusCode, 200);
});

test("a cursor that was not signed by this server is rejected", async () => {
  const body = Buffer.from(JSON.stringify({ p: 0, c: { 0: "next:jeans" } })).toString("base64url");
  const forged = `${body}.${createHmac("sha256", "other-secret-0123456789").update(body).digest("base64url")}`;
  const res = await app().inject({
    method: "GET",
    url: `/catalog/discover?category=jeans&cursor=${encodeURIComponent(forged)}`,
    headers: { authorization: `Bearer ${TOKEN}` },
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
    verify,
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
    verify,
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

test("anonymous logins count only while ALLOW_ANONYMOUS is on; Apple/Google logins always do", async () => {
  const feed = (allow: boolean | undefined, token: string) =>
    app(undefined, allow).inject({ method: "GET", url: "/catalog/discover?category=tops", headers: { authorization: `Bearer ${token}` } });
  assert.equal((await feed(true, ANON_TOKEN)).statusCode, 200);
  assert.equal((await feed(false, ANON_TOKEN)).statusCode, 401);
  assert.equal((await feed(undefined, ANON_TOKEN)).statusCode, 401, "refused unless turned on");
  assert.equal((await feed(false, TOKEN)).statusCode, 200);
});

test("the gate forgets clients whose window has passed, so rotating IPs don't grow memory", (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: 0 });
  const gate = createGate({ windowMs: 1000, max: 5, concurrency: 1000 });
  for (let i = 0; i < 100; i++) gate.tryEnter(`ip-${i}`);
  assert.equal(gate.tracked(), 100);
  t.mock.timers.setTime(1500);
  gate.tryEnter("new-ip");
  assert.equal(gate.tracked(), 1);
});

test("an IPv6 client counts as its whole /64, so rotating addresses inside it doesn't reset the limit", () => {
  const gate = createGate({ windowMs: 60_000, max: 2, concurrency: 10 });
  assert.equal(gate.tryEnter("2001:db8:1:2::a"), "ok");
  gate.leave();
  assert.equal(gate.tryEnter("2001:0db8:0001:0002:ffff:1:2:3"), "ok");
  gate.leave();
  assert.equal(gate.tryEnter("2001:db8:1:2:9::1"), "rate");
  // Another /64, an IPv4-mapped address and a user id are their own clients.
  assert.equal(gate.tryEnter("2001:db8:1:3::a"), "ok");
  assert.equal(gate.tryEnter("::ffff:203.0.113.9"), "ok");
  assert.equal(gate.tryEnter("0a0a0a0a-1b1b-4c2c-8d3d-4e4e4e4e4e4e"), "ok");
});
