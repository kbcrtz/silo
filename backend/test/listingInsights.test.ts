import assert from "node:assert/strict";
import { test } from "node:test";
import { HttpError } from "../src/errors.ts";
import { listingFacts } from "../src/catalog/normalize.ts";
import { createEnricher } from "../src/services/listingInsights.ts";
import type { CreateInteraction } from "../src/services/colorVision.ts";
import { sweater, trouser } from "./fixtures/shopify.ts";

const insight = (i: number, patch: Record<string, unknown> = {}) => ({
  i,
  hex: "#6B7A3A",
  confidence: "high",
  category: "bottom",
  silhouette: "relaxed",
  length: "ankle",
  sleeve: null,
  evidence: "Olive Green; Relaxed fit & drawstring waist",
  ...patch,
});
const replying = (body: unknown): CreateInteraction => async () => ({ output_text: typeof body === "string" ? body : JSON.stringify(body) });
const enricher = (create: CreateInteraction) => createEnricher({ create, model: "gemini-test", timeoutMs: 1234 });

test("listing facts are the text a shopper would read, never images or links", () => {
  const facts = listingFacts(trouser)!;
  assert.deepEqual(facts, {
    title: "Everyday Relaxed Trouser",
    color: "Olive Green",
    options: { "Inseam length": ['30"', '32"'] },
    description: "Relaxed fit & drawstring waist.",
    features: ["Drawstring waist"],
    // Labeled facts ("Length: Mini") beat prose; care instructions say nothing about looks.
    specs: ["Fit: Relaxed", "Length: Full", "Material: Linen blend"],
  });
  assert.ok(!JSON.stringify(facts).includes("http"));
  assert.deepEqual(listingFacts(sweater), { title: "Charcoal Grey Crewneck Sweater", description: "Merino." });
});

test("one text-only call per page, not stored, with a schema, a timeout and no retries", async () => {
  let params: any;
  let options: any;
  const enrich = enricher(async (p, o) => {
    params = p;
    options = o;
    return { output_text: JSON.stringify({ items: [insight(0), insight(1)] }) };
  });
  await enrich([listingFacts(trouser)!, listingFacts(sweater)!]);
  assert.equal(params.model, "gemini-test");
  assert.equal(params.store, false);
  assert.equal(params.generation_config.thinking_level, "low", "a lookup task; thinking only adds seconds (this model rejects minimal)");
  assert.ok(params.input.every((part: any) => part.type === "text"), "text only");
  assert.ok(params.input.at(-1).text.includes("Everyday Relaxed Trouser"));
  assert.equal(params.response_format.mime_type, "application/json");
  assert.equal(params.response_format.schema.$schema, undefined);
  assert.deepEqual(options, { timeout_ms: 1234, retries: { strategy: "none" } });
});

test("answers line up with listings by index; a bad item is skipped, not fatal", async () => {
  const out = await enricher(replying({ items: [insight(1, { hex: "#333333", category: "top", silhouette: "fitted", length: "hip", sleeve: "long" }), insight(0, { hex: "red" })] }))([
    listingFacts(trouser)!,
    listingFacts(sweater)!,
  ]);
  assert.equal(out[0], null); // "red" isn't a hex
  assert.deepEqual(out[1], {
    hex: "#333333",
    confidence: "high",
    cut: { category: "top", silhouette: "fitted", length: "hip", sleeve: "long" },
    evidence: "Olive Green; Relaxed fit & drawstring waist",
  });
});

test("no color in the text means no hex, and no sleeve on bottoms", async () => {
  const [out] = await enricher(replying({ items: [insight(0, { hex: null, confidence: "low" })] }))([listingFacts(trouser)!]);
  assert.equal(out?.hex, null);
  assert.equal(out?.cut.sleeve, undefined);
});

test("unreadable output and provider failures are errors the feed can ignore", async () => {
  await assert.rejects(enricher(replying("not json"))([listingFacts(trouser)!]), (e: unknown) => e instanceof HttpError && e.code === "gemini_invalid_output");
  await assert.rejects(
    enricher(async () => {
      throw Object.assign(new Error("slow"), { name: "APIConnectionTimeoutError" });
    })([listingFacts(trouser)!]),
    (e: unknown) => e instanceof HttpError && e.code === "gemini_timeout",
  );
});

test("a page is split into parallel batches of five, and a failed batch only loses its own items", async () => {
  const sizes: number[] = [];
  let call = 0;
  const enrich = enricher(async (p: any) => {
    const listings = JSON.parse(p.input.at(-1).text) as { i: number }[];
    sizes.push(listings.length);
    if (call++ === 1) throw Object.assign(new Error("overloaded"), { status: 503 });
    return { output_text: JSON.stringify({ items: listings.map((l) => insight(l.i)) }) };
  });
  const out = await enrich(Array.from({ length: 12 }, () => listingFacts(trouser)!));
  assert.deepEqual(sizes, [5, 5, 2]);
  assert.equal(out.length, 12);
  assert.deepEqual(out.map((o) => o !== null), [true, true, true, true, true, false, false, false, false, false, true, true]);
});

test("if every batch fails, the error is reported", async () => {
  const enrich = enricher(async () => {
    throw Object.assign(new Error("overloaded"), { status: 503 });
  });
  await assert.rejects(enrich([listingFacts(trouser)!]), (e: unknown) => e instanceof HttpError && e.code === "gemini_failed");
});
