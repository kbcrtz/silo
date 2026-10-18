import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { loadRules } from "../src/analysis/evaluate.ts";
import { checkRegions, sampleRegion, toPixels, type Box, type RawImage } from "../src/analysis/regions.ts";

const rules = loadRules(JSON.parse(readFileSync(new URL("../rules/color-analysis.v1.json", import.meta.url), "utf8")));

const face: Box = [100, 200, 900, 800];
const valid = {
  face,
  skin: [450, 250, 600, 400] as Box, // left cheek
  lips: [700, 400, 800, 600] as Box,
  hair: [0, 150, 200, 850] as Box,
  iris: [350, 300, 400, 380] as Box,
};

test("toPixels scales [ymin, xmin, ymax, xmax] from 0-1000 to image pixels", () => {
  assert.deepEqual(toPixels([100, 250, 500, 750], 200, 100), { x0: 50, y0: 10, x1: 150, y1: 50 });
  assert.deepEqual(toPixels([0, 0, 1000, 1000], 640, 480), { x0: 0, y0: 0, x1: 640, y1: 480 });
});

test("well-placed regions are all accepted", () => {
  const r = checkRegions(valid, rules);
  assert.deepEqual(Object.keys(r.accepted).sort(), ["face", "hair", "iris", "lips", "skin"]);
  assert.deepEqual(r.rejected, []);
  assert.equal(r.questionable, false);
});

test("regions Gemini did not find are missing, not questionable", () => {
  const r = checkRegions({ ...valid, hair: null, iris: null }, rules);
  assert.equal(r.accepted.hair, undefined);
  assert.equal(r.accepted.iris, undefined);
  assert.equal(r.questionable, false);
});

test("inverted boxes are rejected and flag questionable localization", () => {
  const r = checkRegions({ ...valid, lips: [800, 400, 700, 600] }, rules);
  assert.equal(r.accepted.lips, undefined);
  assert.deepEqual(r.rejected, ["lips"]);
  assert.equal(r.questionable, true);
});

test("out-of-bounds boxes are rejected", () => {
  const r = checkRegions({ ...valid, hair: [-5, 150, 200, 1200] }, rules);
  assert.deepEqual(r.rejected, ["hair"]);
});

test("a face region whose center is outside the face box is rejected", () => {
  const r = checkRegions({ ...valid, skin: [920, 50, 990, 150] }, rules);
  assert.deepEqual(r.rejected, ["skin"]);
});

test("iris below lips rejects both, since either could be wrong", () => {
  const r = checkRegions({ ...valid, iris: [820, 450, 860, 500], lips: [600, 400, 700, 600] }, rules);
  assert.deepEqual(r.rejected.sort(), ["iris", "lips"]);
});

test("heavily overlapping skin and lips boxes are both rejected", () => {
  const r = checkRegions({ ...valid, skin: [690, 390, 790, 590] }, rules);
  assert.deepEqual(r.rejected.sort(), ["lips", "skin"]);
});

test("without a usable face box nothing is accepted", () => {
  const r = checkRegions({ ...valid, face: null }, rules);
  assert.deepEqual(r.accepted, {});
});

function image(width: number, height: number, fill: (x: number, y: number) => [number, number, number]): RawImage {
  const data = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) data.set(fill(x, y), (y * width + x) * 3);
  return { data, width, height };
}

test("sampling ignores the box border, highlights and shadows", () => {
  const skin: [number, number, number] = [200, 150, 120];
  const img = image(100, 100, (x, y) => {
    if (x < 30 || x >= 70 || y < 30 || y >= 70) return [20, 80, 200]; // background around the patch
    if ((x + y) % 17 === 0) return [255, 255, 255]; // specular highlights
    if ((x * y) % 23 === 0) return [12, 8, 6]; // shadows
    return skin;
  });
  // Box is a bit larger than the patch, as Gemini boxes usually are.
  const px = toPixels([260, 260, 740, 740], 100, 100);
  assert.deepEqual(sampleRegion(img, px, rules.sampling.regions.skin, rules.sampling), skin);
});

test("sampling is deterministic", () => {
  const img = image(64, 64, (x, y) => [(x * 3) % 256, (y * 5) % 256, 128]);
  const px = toPixels([100, 100, 900, 900], 64, 64);
  const a = sampleRegion(img, px, rules.sampling.regions.skin, rules.sampling);
  const b = sampleRegion(img, px, rules.sampling.regions.skin, rules.sampling);
  assert.deepEqual(a, b);
});

test("sampling a box too small to trust returns null instead of a color", () => {
  const img = image(100, 100, () => [200, 150, 120]);
  assert.equal(sampleRegion(img, toPixels([500, 500, 530, 530], 100, 100), rules.sampling.regions.skin, rules.sampling), null);
});

test("sampling a region that is all too-dark pixels returns null", () => {
  const img = image(100, 100, () => [3, 3, 3]);
  assert.equal(sampleRegion(img, toPixels([0, 0, 1000, 1000], 100, 100), rules.sampling.regions.hair, rules.sampling), null);
});
