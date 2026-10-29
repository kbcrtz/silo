import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Writable } from "node:stream";
import { test } from "node:test";
import { loadRules } from "../src/analysis/evaluate.ts";
import { buildApp } from "../src/app.ts";
import { createGate, type Gate } from "../src/guard.ts";
import type { Catalog } from "../src/services/shopifyCatalog.ts";
import type { AppEvent, Trending, Trends } from "../src/services/trends.ts";
import { ANON_TOKEN, TOKEN, USER, verify } from "./fixtures/auth.ts";
import { sweater, trouser } from "./fixtures/shopify.ts";

const rules = loadRules(JSON.parse(readFileSync(new URL("../rules/color-analysis.v1.json", import.meta.url), "utf8")));
const SECRET = "test-secret-0123456789";

function setup(opts: { trends?: Trends | null; trending?: Trending; eventsGate?: Gate } = {}) {
  const recorded: { user: string; events: AppEvent[] }[] = [];
  const asked: string[] = [];
  const trends: Trends = {
    async record(user, events) {
      recorded.push({ user, events });
    },
    async trending(season) {
      asked.push(season);
      return opts.trending ?? { items: [], traits: [] };
    },
  };
  const catalog: Catalog = {
    search: async () => ({ products: [sweater, trouser], cursor: null }),
    getProduct: async () => null,
  };
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
    verify,
    gate: createGate({ windowMs: 60_000, max: 100, concurrency: 4 }),
    trends: opts.trends === null ? undefined : (opts.trends ?? trends),
    eventsGate: opts.eventsGate,
    allowAnonymous: true,
  });
  const call = (method: "GET" | "POST", url: string, payload?: unknown, token = TOKEN) =>
    app.inject({ method, url, payload: payload as never, headers: { authorization: `Bearer ${token}` } });
  return { call, recorded, asked, logs };
}

const open = { kind: "open", itemId: "shopify-A", season: "soft-autumn", garment: "top", silhouette: "relaxed", color: "#9CAF88" };

test("events are recorded in a batch under the signed-in user, with the color as a family", async () => {
  const { call, recorded } = setup();
  const res = await call("POST", "/events", { events: [open, { kind: "shop", itemId: "w-01" }] });
  assert.equal(res.statusCode, 204);
  assert.equal(recorded[0].user, USER);
  assert.deepEqual(recorded[0].events[0], { kind: "open", itemId: "shopify-A", season: "soft-autumn", garment: "top", silhouette: "relaxed", family: "Green" });
  assert.deepEqual(recorded[0].events[1], { kind: "shop", itemId: "w-01" });
});

test("bad events never reach the database", async () => {
  const { call, recorded } = setup();
  for (const events of [[{ ...open, kind: "like" }], [{ ...open, itemId: "" }], [{ ...open, garment: "hat" }], Array(101).fill(open)]) {
    assert.equal((await call("POST", "/events", { events })).statusCode, 400);
  }
  assert.equal(recorded.length, 0);
});

test("past the per-user budget, events are dropped with 429; other users keep theirs", async () => {
  const { call, recorded } = setup({ eventsGate: createGate({ windowMs: 60_000, max: 1, concurrency: 4 }) });
  assert.equal((await call("POST", "/events", { events: [open] })).statusCode, 204);
  const res = await call("POST", "/events", { events: [open] });
  assert.equal(res.statusCode, 429);
  assert.deepEqual(res.json(), { error: "rate_limited" });
  assert.equal((await call("POST", "/events", { events: [open] }, ANON_TOKEN)).statusCode, 204);
  assert.equal(recorded.length, 2);
});

test("without a database, events answer 503", async () => {
  assert.equal((await setup({ trends: null }).call("POST", "/events", { events: [open] })).statusCode, 503);
});

test("the feed marks products popular with the shopper's season and moves them up", async () => {
  const trending = { items: ["shopify-AAA111"], traits: [] };
  const { call, asked } = setup({ trending });
  const body = (await call("GET", "/catalog/discover?category=tops&season=soft-autumn")).json();
  assert.deepEqual(asked, ["soft-autumn"]);
  assert.equal(body.products[0].id, trouser.id); // AAA111 moved ahead of the sweater
  assert.equal(body.products[0].popular, true);
  assert.equal(body.products[1].popular, undefined);
});

test("no season, no trending lookup; a failed lookup leaves the feed alone", async () => {
  const quiet = setup();
  await quiet.call("GET", "/catalog/discover?category=tops");
  assert.deepEqual(quiet.asked, []);
  const failing: Trends = { record: async () => {}, trending: async () => Promise.reject(new Error("db down")) };
  const res = await setup({ trends: failing }).call("GET", "/catalog/discover?category=tops&season=soft-autumn");
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.json().products.map((p: any) => p.id), [sweater.id, trouser.id]);
});

test("a slow trending lookup is dropped instead of holding up the feed", async () => {
  const slow: Trends = { record: async () => {}, trending: () => new Promise(() => {}) };
  const started = performance.now();
  const res = await setup({ trends: slow }).call("GET", "/catalog/discover?category=tops&season=soft-autumn");
  assert.equal(res.statusCode, 200);
  assert.ok(performance.now() - started < 3000);
  assert.ok(res.json().products.every((p: any) => p.popular === undefined));
});
