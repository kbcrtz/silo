import assert from "node:assert/strict";
import { HttpError } from "../src/errors.ts";
import { readFileSync } from "node:fs";
import { Writable } from "node:stream";
import { test } from "node:test";
import sharp from "sharp";
import { buildApp, type Locate } from "../src/app.ts";
import { evaluate, loadRules, type Warnings } from "../src/analysis/evaluate.ts";
import type { Box } from "../src/analysis/regions.ts";

const rules = loadRules(JSON.parse(readFileSync(new URL("../rules/color-analysis.v1.json", import.meta.url), "utf8")));
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

// A 400x400 "selfie" drawn in flat colors, with boxes that match it.
const SIZE = 400;
const COLORS = { skin: [205, 160, 130], lips: [185, 105, 100], hair: [70, 45, 30], iris: [95, 65, 45] } as const;
const BOXES = {
  face: [100, 100, 950, 900],
  hair: [0, 100, 150, 900],
  iris: [350, 300, 400, 380],
  skin: [450, 200, 650, 400],
  lips: [750, 400, 850, 600],
} satisfies Record<string, Box>;

async function selfie(format: "png" | "jpeg"): Promise<Buffer> {
  const data = Buffer.alloc(SIZE * SIZE * 3);
  const paint = (b: Box, c: readonly number[]) => {
    for (let y = (b[0] * SIZE) / 1000; y < (b[2] * SIZE) / 1000; y++)
      for (let x = (b[1] * SIZE) / 1000; x < (b[3] * SIZE) / 1000; x++) data.set(c, (y * SIZE + x) * 3);
  };
  data.fill(240); // background
  paint(BOXES.face, COLORS.skin);
  paint(BOXES.hair, COLORS.hair);
  paint(BOXES.iris, COLORS.iris);
  paint(BOXES.lips, COLORS.lips);
  return sharp(data, { raw: { width: SIZE, height: SIZE, channels: 3 } })[format]().toBuffer();
}

async function multipart(field: string, file: Buffer, type: string, filename = "selfie.jpg") {
  const form = new FormData();
  form.append(field, new Blob([new Uint8Array(file)], { type }), filename);
  const req = new Request("http://local/", { method: "POST", body: form });
  return { payload: Buffer.from(await req.arrayBuffer()), headers: { "content-type": req.headers.get("content-type")! } };
}

function setup(locate: Locate) {
  const logs: any[] = [];
  const stream = new Writable({
    write(chunk, _enc, done) {
      for (const line of String(chunk).split("\n").filter(Boolean)) logs.push(JSON.parse(line));
      done();
    },
  });
  let calls = 0;
  const app = buildApp({ rules, model: "gemini-test", logger: { level: "info", stream }, locate: (jpeg) => (calls++, locate(jpeg)) });
  return { app, logs, calls: () => calls };
}

const found: Locate = async () => ({ regions: BOXES, warnings: none });

async function post(app: ReturnType<typeof buildApp>, body: { payload: Buffer; headers: Record<string, string> }) {
  return app.inject({ method: "POST", url: "/color-analysis", ...body });
}

test("a selfie flows through localization, pixel sampling and the rules to the exact contract", async () => {
  const { app } = setup(found);
  // PNG bytes under a JPEG label and filename: the bytes decide.
  const res = await post(app, await multipart("selfie", await selfie("png"), "image/jpeg"));
  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.deepEqual(Object.keys(body).sort(), ["clarity", "confidence", "depth", "warmth"]);
  const expected = evaluate({ colors: COLORS, warnings: none, localizationQuestionable: false }, rules);
  assert.ok(expected.ok);
  assert.deepEqual(body, expected.response);
  assert.ok(res.headers["x-request-id"]);
});

test("a JPEG selfie returns numbers within the contract ranges", async () => {
  const { app } = setup(found);
  const res = await post(app, await multipart("selfie", await selfie("jpeg"), "image/jpeg"));
  assert.equal(res.statusCode, 200);
  const { warmth, depth, clarity, confidence } = res.json();
  for (const v of [warmth, depth, clarity]) assert.ok(v >= -1 && v <= 1);
  assert.ok(confidence >= 0 && confidence <= 1);
});

test("a missing selfie field is a 400 and never reaches Gemini", async () => {
  const { app, calls } = setup(found);
  const res = await post(app, await multipart("photo", await selfie("png"), "image/jpeg"));
  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.json(), { error: "missing_selfie" });
  assert.equal(calls(), 0);
});

test("a non-image labeled as JPEG is rejected without calling Gemini", async () => {
  const { app, calls } = setup(found);
  const res = await post(app, await multipart("selfie", Buffer.from("not really a photo"), "image/jpeg"));
  assert.equal(res.statusCode, 415);
  assert.deepEqual(res.json(), { error: "unsupported_image_type" });
  assert.equal(calls(), 0);
});

test("a Gemini timeout is a 504 the app treats as retake or quiz-only", async () => {
  const { app } = setup(async () => {
    throw new HttpError("gemini_timeout", 504);
  });
  const res = await post(app, await multipart("selfie", await selfie("png"), "image/jpeg"));
  assert.equal(res.statusCode, 504);
  assert.deepEqual(res.json(), { error: "gemini_timeout" });
});

test("a Gemini failure logs the provider status, not just gemini_failed", async () => {
  const { app, logs } = setup(async () => {
    throw new HttpError("gemini_failed", 502, 402);
  });
  const res = await post(app, await multipart("selfie", await selfie("png"), "image/jpeg"));
  assert.equal(res.statusCode, 502);
  assert.deepEqual(res.json(), { error: "gemini_failed" });
  const d = logs.find((l) => l.colorAnalysis)?.colorAnalysis;
  assert.equal(d.error, "gemini_failed");
  assert.equal(d.providerStatus, 402);
});

test("invalid Gemini output is a 502, never a made-up result", async () => {
  const { app } = setup(async () => {
    throw new HttpError("gemini_invalid_output", 502);
  });
  const res = await post(app, await multipart("selfie", await selfie("png"), "image/jpeg"));
  assert.equal(res.statusCode, 502);
});

test("no usable face is a 422", async () => {
  const { app } = setup(async () => ({ regions: { ...BOXES, face: null }, warnings: none }));
  const res = await post(app, await multipart("selfie", await selfie("png"), "image/jpeg"));
  assert.equal(res.statusCode, 422);
  assert.deepEqual(res.json(), { error: "no_usable_face" });
});

test("lip makeup neutralizes warmth and caps confidence at 0.20", async () => {
  const { app } = setup(async () => ({ regions: BOXES, warnings: { ...none, lipMakeup: true } }));
  const res = await post(app, await multipart("selfie", await selfie("png"), "image/jpeg"));
  assert.equal(res.statusCode, 200);
  assert.equal(res.json().warmth, 0);
  assert.equal(res.json().confidence, 0.2);
});

test("missing hair and iris lower confidence to the hair cap", async () => {
  const { app } = setup(async () => ({ regions: { ...BOXES, hair: null, iris: null }, warnings: none }));
  const res = await post(app, await multipart("selfie", await selfie("png"), "image/jpeg"));
  assert.equal(res.json().confidence, 0.55);
});

test("logs prove each stage ran without logging colors, traits or images", async () => {
  const { app, logs } = setup(async () => ({ regions: { ...BOXES, hair: null }, warnings: { ...none, colorCast: true } }));
  await post(app, await multipart("selfie", await selfie("png"), "image/jpeg"));
  const entry = logs.find((l) => l.colorAnalysis);
  assert.ok(entry, "no color_analysis log line");
  const d = entry.colorAnalysis;
  assert.ok(entry.reqId);
  assert.equal(d.model, "gemini-test");
  assert.equal(d.rulesVersion, "1.1.0");
  assert.deepEqual(d.regionsReturned, { face: true, skin: true, lips: true, hair: false, iris: true });
  assert.deepEqual(d.sampled, { skin: true, lips: true, hair: false, iris: true });
  assert.deepEqual(d.metrics, { subtone: true, intensity: true, value: true, contrast: false });
  assert.deepEqual(d.penalties, ["colorCast"]);
  assert.deepEqual(d.caps, ["hair"]);
  assert.equal(d.outputValid, true);
  assert.equal(typeof d.durationMs, "number");
  const all = JSON.stringify(logs);
  for (const forbidden of ["warmth", "clarity", "confidence\":", String(COLORS.skin), "base64"]) assert.ok(!all.includes(forbidden), `log leaked ${forbidden}`);
});
