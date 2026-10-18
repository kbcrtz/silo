import { readFileSync } from "node:fs";
import postgres from "postgres";
import { GoogleGenAI } from "@google/genai";
import { loadRules } from "./analysis/evaluate.ts";
import { buildApp } from "./app.ts";
import { createGate } from "./guard.ts";
import { locateRegions, type CreateInteraction } from "./services/colorVision.ts";
import { createEnricher } from "./services/listingInsights.ts";
import { createCatalog } from "./services/shopifyCatalog.ts";
import { createTrends, migrateTrends } from "./services/trends.ts";
import { createUserData, migrate } from "./services/userData.ts";

const secret = process.env.API_SECRET ?? "";
if (secret.length < 16) {
  console.error("API_SECRET must be at least 16 characters. Copy .env.template to .env.");
  process.exit(1);
}

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("GEMINI_API_KEY is not set. Copy .env.template to .env.");
  process.exit(1);
}
const model = process.env.GEMINI_MODEL ?? "gemini-3.8-flash";
const timeoutMs = Number(process.env.GEMINI_TIMEOUT_MS ?? 20_000);
if (!(timeoutMs > 0)) {
  console.error("GEMINI_TIMEOUT_MS must be a positive number of milliseconds.");
  process.exit(1);
}
// Fails fast at startup if the rule document is invalid.
const rules = loadRules(JSON.parse(readFileSync(new URL("../rules/color-analysis.v1.json", import.meta.url), "utf8")));

const client = new GoogleGenAI({ apiKey });
const create: CreateInteraction = async (params, options) =>
  (await client.interactions.create(params as never, options)) as { output_text?: string };

const catalogTimeoutMs = Number(process.env.CATALOG_TIMEOUT_MS ?? 8_000);
if (!(catalogTimeoutMs > 0)) {
  console.error("CATALOG_TIMEOUT_MS must be a positive number of milliseconds.");
  process.exit(1);
}
const catalog = createCatalog({
  fetch,
  endpoint: process.env.SHOPIFY_CATALOG_URL ?? "https://catalog.shopify.com/api/ucp/mcp",
  // Shopify's documented example profile is fine for testing; host our own before relying on it.
  profile: process.env.SHOPIFY_AGENT_PROFILE ?? "https://shopify.dev/ucp/agent-profiles/examples/2026-08-25/valid-with-capabilities.json",
  country: process.env.CATALOG_COUNTRY ?? "US",
  timeoutMs: catalogTimeoutMs,
});

// One Gemini call per feed page reads the listings' text for color and cut. CATALOG_AI=off skips it.
const enrichTimeoutMs = Number(process.env.CATALOG_AI_TIMEOUT_MS ?? 3_000);
if (!(enrichTimeoutMs > 0)) {
  console.error("CATALOG_AI_TIMEOUT_MS must be a positive number of milliseconds.");
  process.exit(1);
}
// Flash-Lite: on a 20-listing page it took ~1.5 s against ~4 s for Flash, agreeing on category and cut (2026-10-18).
const enrichModel = process.env.CATALOG_AI_MODEL ?? "gemini-3.5-flash-lite";
const enrich = process.env.CATALOG_AI === "off" ? undefined : createEnricher({ create, model: enrichModel, timeoutMs: enrichTimeoutMs });

// Tiger Cloud Postgres backs up the app's on-device data. Without it, /me answers 503 and everything else works.
const databaseUrl = process.env.TIGER_DATABASE_URL;
let userData;
let trends;
if (databaseUrl) {
  // onnotice: the migrations' "already exists, skipping" notices are expected on every start.
  const sql = postgres(databaseUrl, { ssl: "require", max: 5, idle_timeout: 30, onnotice: () => {} });
  await migrate(sql);
  await migrateTrends(sql);
  userData = createUserData(sql);
  trends = createTrends(sql);
} else {
  console.warn("TIGER_DATABASE_URL is not set; /me routes are off.");
}

// One person retaking a selfie stays under this. A loop does not, and only two Gemini calls run at once.
const gate = createGate({ windowMs: 10 * 60_000, max: 8, concurrency: 2 });
const app = buildApp({
  rules,
  model,
  logger: true,
  catalog,
  secret,
  gate,
  enrich,
  userData,
  trends,
  locate: (jpeg) => locateRegions(jpeg, { create, model, timeoutMs }),
});
await app.listen({ port: Number(process.env.PORT ?? 8080), host: "0.0.0.0" });
