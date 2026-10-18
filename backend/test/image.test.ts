import assert from "node:assert/strict";
import { HttpError } from "../src/errors.ts";
import { test } from "node:test";
import sharp from "sharp";
import { prepareSelfie } from "../src/services/image.ts";

const solid = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 3, background: { r: 200, g: 150, b: 120 } } });

async function rejects(buf: Buffer, code: string, status: number) {
  await assert.rejects(prepareSelfie(buf), (e: unknown) => {
    assert.ok(e instanceof HttpError, String(e));
    assert.equal(e.code, code);
    assert.equal(e.status, status);
    return true;
  });
}

test("accepts a JPEG and returns oriented RGB pixels plus a JPEG for the model", async () => {
  const out = await prepareSelfie(await solid(640, 480).jpeg().toBuffer());
  assert.equal(out.raw.width, 640);
  assert.equal(out.raw.height, 480);
  assert.equal(out.raw.data.length, 640 * 480 * 3);
  assert.deepEqual([...out.modelJpeg.subarray(0, 3)], [0xff, 0xd8, 0xff]);
});

test("accepts PNG and WebP by their bytes", async () => {
  assert.equal((await prepareSelfie(await solid(400, 400).png().toBuffer())).raw.width, 400);
  assert.equal((await prepareSelfie(await solid(400, 400).webp().toBuffer())).raw.width, 400);
});

test("rejects non-image bytes as an unsupported type", async () => {
  await rejects(Buffer.from("definitely not an image, just some text bytes"), "unsupported_image_type", 415);
});

test("rejects HEIC explicitly", async () => {
  const heicHeader = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from("ftypheic"), Buffer.alloc(64)]);
  await rejects(heicHeader, "unsupported_image_type", 415);
});

test("rejects a truncated JPEG as malformed", async () => {
  const jpeg = await solid(640, 480).jpeg().toBuffer();
  await rejects(jpeg.subarray(0, 120), "invalid_image", 400);
});

test("rejects images smaller than the minimum side", async () => {
  await rejects(await solid(100, 100).jpeg().toBuffer(), "image_dimensions", 422);
});

test("rejects files over the byte limit before decoding", async () => {
  const big = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(8 * 1024 * 1024)]);
  await rejects(big, "file_too_large", 413);
});

test("rejects an empty upload", async () => {
  await rejects(Buffer.alloc(0), "empty_file", 400);
});

test("applies EXIF orientation and strips metadata from the model copy", async () => {
  const rotated = await solid(300, 400).jpeg().withMetadata({ orientation: 6 }).toBuffer();
  const out = await prepareSelfie(rotated);
  assert.equal(out.raw.width, 400);
  assert.equal(out.raw.height, 300);
  const meta = await sharp(out.modelJpeg).metadata();
  assert.equal(meta.orientation, undefined);
  assert.equal(meta.exif, undefined);
});

test("samples and sends the same downscaled copy, so large photos stay cheap", async () => {
  const out = await prepareSelfie(await solid(3000, 2000).jpeg().toBuffer());
  const meta = await sharp(out.modelJpeg).metadata();
  assert.deepEqual([meta.width, meta.height], [1536, 1024]);
  assert.deepEqual([out.raw.width, out.raw.height], [1536, 1024]);
  assert.equal(out.raw.data.length, 1536 * 1024 * 3);
});
