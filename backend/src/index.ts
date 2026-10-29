import { readFileSync } from "node:fs";
import postgres from "postgres";
import { GoogleGenAI } from "@google/genai";
import { createRemoteJWKSet } from "jose";
import { loadRules } from "./analysis/evaluate.ts";
import { buildApp } from "./app.ts";
import { supabaseVerifier } from "./auth.ts";
import { createGate } from "./guard.ts";
import { supabaseAccounts } from "./services/account.ts";
import { appleRevoker } from "./services/appleRevoke.ts";
import { locateRegions, type CreateInteraction } from "./services/colorVision.ts";
import { createEnricher } from "./services/listingInsights.ts";
import { createCatalog } from "./services/shopifyCatalog.ts";
import { createTrends } from "./services/trends.ts";
import { createTryOn, memoryStore, postgresStore, type TryOnStore } from "./services/tryOnImage.ts";
import { createUserData } from "./services/userData.ts";

const secret = process.env.CURSOR_SECRET ?? "";
if (secret.length < 16) {
  console.error("CURSOR_SECRET must be at least 16 characters. Copy .env.template to .env.");
  process.exit(1);
}

// Supabase Auth: login tokens are checked against the project's public signing keys.
const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/+$/, "");
if (!supabaseUrl) {
  console.error("SUPABASE_URL is not set. Copy .env.template to .env.");
  process.exit(1);
}
const verify = supabaseVerifier({
  issuer: `${supabaseUrl}/auth/v1`,
  keys: createRemoteJWKSet(new URL(`${supabaseUrl}/auth/v1/.well-known/jwks.json`)),
});
// Account deletion needs the secret key; without it DELETE /me answers 503.
const secretKey = process.env.SUPABASE_SECRET_KEY;
const deleteAccount = secretKey ? supabaseAccounts({ url: supabaseUrl, secretKey, fetch }) : undefined;
// The app's silent anonymous sign-in counts as signed in until Apple/Google ships; set ALLOW_ANONYMOUS=false then.
const allowAnonymous = process.env.ALLOW_ANONYMOUS !== "false";
// Sign in with Apple token revocation on account deletion; needs a Sign in with Apple key from the Apple Developer account.
const { APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_PRIVATE_KEY } = process.env;
const revokeApple =
  APPLE_TEAM_ID && APPLE_KEY_ID && APPLE_PRIVATE_KEY
    ? appleRevoker({
        teamId: APPLE_TEAM_ID,
        keyId: APPLE_KEY_ID,
        privateKey: APPLE_PRIVATE_KEY,
        clientId: process.env.APPLE_CLIENT_ID ?? "com.siloapp.ios",
        fetch,
      })
    : undefined;

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
// 30 AI-read pages per user per 10 minutes (up to 120 Gemini calls), 4 at once; past that, pages skip the estimates.
const estimateGate = createGate({ windowMs: 10 * 60_000, max: 30, concurrency: 4 });

// Supabase Postgres holds signed-in users' data; tables come from supabase/migrations.
// Without DATABASE_URL, /me answers 503 and everything else works. SSL comes from the URL (?sslmode=require).
const databaseUrl = process.env.DATABASE_URL;
let userData;
let trends;
let tryOnStore: TryOnStore = memoryStore();
if (databaseUrl) {
  const sql = postgres(databaseUrl, { max: 5, idle_timeout: 30 });
  userData = createUserData(sql);
  trends = createTrends(sql);
  tryOnStore = postgresStore(sql);
} else {
  console.warn("DATABASE_URL is not set; /me routes are off.");
}

// AI try-on images: Gemini image generation from the store photo, saved once per product and department.
// Flash-lite image took ~3-4 s in tests (2026-10-18); TRYON_IMAGE_MODEL switches it.
const tryOn = createTryOn({
  generateContent: (request) => client.models.generateContent(request as never) as never,
  model: process.env.TRYON_IMAGE_MODEL ?? "gemini-3.1-flash-lite-image",
  timeoutMs: 30_000,
  fetch,
  store: tryOnStore,
});
// 20 new images per user per 10 minutes, 3 at once; saved images don't count.
const tryOnGate = createGate({ windowMs: 10 * 60_000, max: 20, concurrency: 3 });
// Anonymous logins are free to make, so together they get 60 per IP per 10 minutes: room for a few people on one Wi-Fi.
const anonymousTryOnGate = createGate({ windowMs: 10 * 60_000, max: 60, concurrency: 3 });
// The app sends a batch at most every 3 s of tapping; this is far above that and stops a flood of rows.
const eventsGate = createGate({ windowMs: 10 * 60_000, max: 100, concurrency: 1 });

// One person retaking a selfie stays under this. A loop does not, and only two Gemini calls run at once.
const gate = createGate({ windowMs: 10 * 60_000, max: 8, concurrency: 2 });
const app = buildApp({
  rules,
  model,
  logger: true,
  catalog,
  secret,
  verify,
  deleteAccount,
  allowAnonymous,
  revokeApple,
  gate,
  enrich,
  estimateGate,
  userData,
  trends,
  tryOn,
  tryOnGate,
  anonymousTryOnGate,
  eventsGate,
  // Railway's proxy connects from 100.64.0.0/10 and appends the client's address to X-Forwarded-For.
  trustProxy: process.env.TRUST_PROXY ?? "100.64.0.0/10",
  locate: (jpeg) => locateRegions(jpeg, { create, model, timeoutMs }),
});
await app.listen({ port: Number(process.env.PORT ?? 8080), host: "0.0.0.0" });
