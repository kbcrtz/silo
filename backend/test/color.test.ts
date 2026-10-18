import assert from "node:assert/strict";
import { test } from "node:test";
import { deltaE76, rgbToHsv, rgbToLab } from "../src/analysis/color.ts";

const close = (actual: number, expected: number, tol = 0.01) =>
  assert.ok(Math.abs(actual - expected) <= tol, `${actual} not within ${tol} of ${expected}`);

test("rgbToHsv matches OpenCV's float HSV saturation and value", () => {
  assert.deepEqual(rgbToHsv([255, 0, 0]), { s: 1, v: 1 });
  assert.deepEqual(rgbToHsv([0, 0, 0]), { s: 0, v: 0 });
  const grey = rgbToHsv([128, 128, 128]);
  assert.equal(grey.s, 0);
  close(grey.v, 128 / 255, 1e-9);
  close(rgbToHsv([200, 100, 50]).s, 0.75, 1e-9);
});

test("rgbToLab matches the sRGB D65 reference values skimage produces", () => {
  const white = rgbToLab([255, 255, 255]);
  close(white.l, 100);
  close(white.a, 0);
  close(white.b, 0);
  const red = rgbToLab([255, 0, 0]);
  close(red.l, 53.24);
  close(red.a, 80.09);
  close(red.b, 67.2);
});

test("deltaE76 is Euclidean distance in Lab", () => {
  close(deltaE76([255, 255, 255], [0, 0, 0]), 100);
  assert.equal(deltaE76([12, 34, 56], [12, 34, 56]), 0);
});
