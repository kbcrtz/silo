import { readFileSync } from "node:fs";
import { GoogleGenAI } from "@google/genai";
import { loadRules } from "./analysis/evaluate.ts";
import { buildApp } from "./app.ts";
import { locateRegions, type CreateInteraction } from "./services/colorVision.ts";
import { createCatalog } from "./services/shopifyCatalog.ts";

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

const app = buildApp({ rules, model, logger: true, catalog, locate: (jpeg) => locateRegions(jpeg, { create, model, timeoutMs }) });
await app.listen({ port: Number(process.env.PORT ?? 8080), host: "0.0.0.0" });
