import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Writable } from "node:stream";
import { test } from "node:test";
import { loadRules } from "../src/analysis/evaluate.ts";
import { buildApp } from "../src/app.ts";
import { createGate } from "../src/guard.ts";
import type { Catalog } from "../src/services/shopifyCatalog.ts";
import type { AppEvent, Trending, Trends } from "../src/services/trends.ts";
import { sweater, trouser } from "./fixtures/shopify.ts";

const rules = loadRules(JSON.parse(readFileSync(new URL("../rules/color-analysis.v1.json", import.meta.url), "utf8")));
const SECRET = "test-secret-0123456789";
const USER = "6f1d2c3b-4a5e-4f60-8a7b-9c0d1e2f3a4b";

function setup(opts: { trends?: Trends | null; trending?: Trending } = {}) {
  const recorded: { device: string; events: AppEvent[] }[] = [];
  const asked: string[] = [];
  const trends: Trends = {
    async record(device, events) {
      recorded.push({ device, events });
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
    gate: createGate({ windowMs: 60_000, max: 100, concurrency: 4 }),
    trends: opts.trends === null ? undefined : (opts.trends ?? trends),
  });
  const call = (method: "GET" | "POST", url: string, payload?: unknown, user: string | null = USER) =>
    app.inject({ method, url, payload: payload as never, headers: { authorization: `Bearer ${SECRET}`, ...(user && { "x-device-id": user }) } });
  return { call, recorded, asked, logs };
}

const open = { kind: "open", itemId: "shopify-A", season: "soft-autumn", garment: "top", silhouette: "relaxed", color: "#9CAF88" };

test("events are recorded in a batch under the device, with the color as a family", async () => {
  const { call, recorded } = setup();
  const res = await call("POST", "/events", { events: [open, { kind: "shop", itemId: "w-01" }] });
  assert.equal(res.statusCode, 204);
  assert.equal(recorded[0].device, USER);
  assert.deepEqual(recorded[0].events[0], { kind: "open", itemId: "shopify-A", season: "soft-autumn", garment: "top", silhouette: "relaxed", family: "Green" });
  assert.deepEqual(recorded[0].events[1], { kind: "shop", itemId: "w-01" });
});

test("bad events never reach the database", async () => {
  const { call, recorded } = setup();
  for (const events of [[{ ...open, kind: "like" }], [{ ...open, itemId: "" }], [{ ...open, garment: "hat" }], Array(101).fill(open)]) {
    assert.equal((await call("POST", "/events", { events })).statusCode, 400);
  }
  assert.equal((await call("POST", "/events", { events: [open] }, null)).statusCode, 400);
  assert.equal(recorded.length, 0);
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
