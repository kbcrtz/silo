import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { deltaE76 } from "../src/analysis/color.ts";
import {
  colorsToMetrics,
  evaluate,
  loadRules,
  metricsToTraits,
  scoreConfidence,
  type Warnings,
} from "../src/analysis/evaluate.ts";

const raw = JSON.parse(readFileSync(new URL("../rules/color-analysis.v1.json", import.meta.url), "utf8"));
const rules = loadRules(raw);

const none: Warnings = {
  lipMakeup: false,
  colorCast: false,
  beautyFilter: false,
  occlusion: false,
  unevenLighting: false,
  overexposed: false,
  underexposed: false,
  blur: false,
  unreliableRegions: false,
};
const close = (actual: number, expected: number) =>
  assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} !== ${expected}`);

test("loadRules accepts the shipped rule document and rejects a broken one", () => {
  assert.equal(rules.version, "1.1.0");
  assert.throws(() => loadRules({ ...raw, cutoffs: undefined }));
  assert.throws(() => loadRules({ ...raw, normalization: { ...raw.normalization, depthSpread: 0 } }));
});

test("metrics exactly at the DSCAS cutoffs map to neutral traits", () => {
  const t = metricsToTraits({ subtoneGap: 0, intensity: 0.422, value: 0.39, contrast: 0.2 }, rules);
  close(t.warmth, 0);
  close(t.depth, 0);
  close(t.clarity, 0);
});

test("intermediate metrics map linearly through the spreads and weights", () => {
  const t = metricsToTraits({ subtoneGap: 20, intensity: 0.522, value: 0.29, contrast: 0.275 }, rules);
  close(t.warmth, 0.5);
  close(t.depth, 0.5); // darker than the cutoff = deeper
  close(t.clarity, 0.7 * 0.5 + 0.3 * 0.5);
  close(metricsToTraits({ subtoneGap: -20, intensity: 0.422, value: 0.39 }, rules).warmth, -0.5);
});

test("traits clamp to [-1, 1]", () => {
  const dark = metricsToTraits({ subtoneGap: 100, intensity: 1, value: 0, contrast: 1 }, rules);
  assert.deepEqual(dark, { warmth: 1, depth: 1, clarity: 1 });
  const light = metricsToTraits({ subtoneGap: -100, intensity: 0, value: 1, contrast: 0 }, rules);
  assert.deepEqual(light, { warmth: -1, depth: -1, clarity: -1 });
});

test("clarity uses intensity alone when contrast is unavailable", () => {
  close(metricsToTraits({ intensity: 0.522, value: 0.39 }, rules).clarity, 0.5);
});

test("warmth is neutral when there is no usable lip color", () => {
  assert.equal(metricsToTraits({ intensity: 0.5, value: 0.5 }, rules).warmth, 0);
});

test("colorsToMetrics applies the DSCAS measurements to region colors", () => {
  const skin = [200, 150, 120] as const;
  const hair = [60, 40, 30] as const;
  const iris = [90, 60, 40] as const;
  const lips = [180, 100, 100] as const;
  const m = colorsToMetrics({ skin, hair, iris, lips }, rules);
  close(m.intensity!, 0.4);
  close(m.value!, (200 + 60 + 90) / 3 / 255);
  close(m.contrast!, 30 / 255);
  close(m.subtoneGap!, deltaE76(lips, [210, 120, 180]) - deltaE76(lips, [255, 230, 182]));
});

test("value falls back to the available regions and contrast needs hair and iris", () => {
  const skin = [200, 150, 120] as const;
  const noHair = colorsToMetrics({ skin, iris: [90, 60, 40] }, rules);
  close(noHair.value!, (200 + 90) / 2 / 255);
  assert.equal(noHair.contrast, undefined);
  const noIris = colorsToMetrics({ skin, hair: [60, 40, 30] }, rules);
  close(noIris.value!, (200 + 60) / 2 / 255);
  assert.equal(noIris.contrast, undefined);
  close(colorsToMetrics({ skin }, rules).value!, 200 / 255);
});

test("confidence starts at 1 and subtracts each penalty", () => {
  assert.equal(scoreConfidence({ warnings: none, missing: [], localizationQuestionable: false }, rules).confidence, 1);
  const r = scoreConfidence({ warnings: { ...none, colorCast: true, blur: true }, missing: [], localizationQuestionable: false }, rules);
  close(r.confidence, 0.5);
  assert.deepEqual(r.penalties, ["colorCast", "blur"]);
});

test("confidence clamps at 0 when penalties exceed 1", () => {
  const all = { ...none, colorCast: true, unevenLighting: true, blur: true, beautyFilter: true, unreliableRegions: true };
  assert.equal(scoreConfidence({ warnings: all, missing: [], localizationQuestionable: false }, rules).confidence, 0);
});

test("questionable localization is penalized once whichever side flags it", () => {
  const both = scoreConfidence({ warnings: { ...none, unreliableRegions: true }, missing: [], localizationQuestionable: true }, rules);
  close(both.confidence, 0.75);
  close(scoreConfidence({ warnings: none, missing: [], localizationQuestionable: true }, rules).confidence, 0.75);
});

test("missing regions cap confidence and the lowest cap wins", () => {
  const cap = (missing: ("lips" | "hair" | "iris")[]) =>
    scoreConfidence({ warnings: none, missing, localizationQuestionable: false }, rules).confidence;
  assert.equal(cap(["lips"]), 0.2);
  assert.equal(cap(["hair"]), 0.55);
  assert.equal(cap(["iris"]), 0.6);
  assert.equal(cap(["hair", "iris"]), 0.55);
});

test("penalties and caps combine: the lower result applies", () => {
  const score = (w: Partial<Warnings>) =>
    scoreConfidence({ warnings: { ...none, ...w }, missing: ["hair"], localizationQuestionable: false }, rules).confidence;
  assert.equal(score({ colorCast: true }), 0.55); // 0.70 after penalty, capped to 0.55
  close(score({ colorCast: true, beautyFilter: true }), 0.35); // 0.35 is below the cap
});

test("occlusion and bad exposure each lower confidence", () => {
  const score = (w: Partial<Warnings>) =>
    scoreConfidence({ warnings: { ...none, ...w }, missing: [], localizationQuestionable: false }, rules);
  close(score({ occlusion: true }).confidence, 0.8);
  close(score({ overexposed: true }).confidence, 0.8);
  close(score({ underexposed: true }).confidence, 0.8);
  assert.deepEqual(score({ occlusion: true, underexposed: true }).penalties, ["occlusion", "underexposed"]);
});

test("lip makeup only caps confidence through the missing lips, not as a penalty", () => {
  const r = scoreConfidence({ warnings: { ...none, lipMakeup: true }, missing: [], localizationQuestionable: false }, rules);
  assert.equal(r.confidence, 1);
});

test("evaluate ignores made-up lips: neutral warmth and confidence capped at 0.20", () => {
  const colors = { skin: [200, 150, 120], lips: [230, 40, 90], hair: [60, 40, 30], iris: [90, 60, 40] } as const;
  const r = evaluate({ colors, warnings: { ...none, lipMakeup: true }, localizationQuestionable: false }, rules);
  assert.ok(r.ok);
  assert.equal(r.response.warmth, 0);
  assert.equal(r.response.confidence, 0.2);
  assert.equal(r.diagnostics.metrics.subtone, false);
  assert.deepEqual(r.diagnostics.caps, ["lips"]);
});

test("evaluate returns exactly the four contract fields", () => {
  const colors = { skin: [200, 150, 120], lips: [190, 110, 100], hair: [60, 40, 30], iris: [90, 60, 40] } as const;
  const r = evaluate({ colors, warnings: none, localizationQuestionable: false }, rules);
  assert.ok(r.ok);
  assert.deepEqual(Object.keys(r.response).sort(), ["clarity", "confidence", "depth", "warmth"]);
  assert.equal(r.response.confidence, 1);
});

test("evaluate refuses to produce traits without skin", () => {
  const r = evaluate({ colors: { lips: [190, 110, 100] }, warnings: none, localizationQuestionable: false }, rules);
  assert.equal(r.ok, false);
  assert.equal(r.ok === false && r.reason, "no_usable_skin");
});
