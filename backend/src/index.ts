import { readFileSync } from "node:fs";
import { GoogleGenAI } from "@google/genai";
import { loadRules } from "./analysis/evaluate.ts";
import { buildApp } from "./app.ts";
import { locateRegions, type CreateInteraction } from "./services/colorVision.ts";

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

const app = buildApp({ rules, model, logger: true, locate: (jpeg) => locateRegions(jpeg, { create, model, timeoutMs }) });
await app.listen({ port: Number(process.env.PORT ?? 8080), host: "0.0.0.0" });
