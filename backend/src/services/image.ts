import sharp from "sharp";
import { HttpError } from "../errors.ts";
import type { RawImage } from "../analysis/regions.ts";

export const MAX_BYTES = 8 * 1024 * 1024;
const MIN_SIDE = 256;
const MAX_SIDE = 8000;
const MAX_PIXELS = 25_000_000;
/**
 * Long side of the one working copy: Gemini sees it and the server samples it.
 * Region medians don't need more, and full-resolution sampling cost ~2 s and
 * ~400 MB per request at the pixel limit.
 */
const WORK_SIDE = 1536;

type Format = "jpeg" | "png" | "webp";

/** Identifies the format from magic bytes; the uploaded MIME label and filename are ignored. */
function sniff(b: Buffer): Format | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpeg";
  if (b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (b.length >= 12 && b.toString("latin1", 0, 4) === "RIFF" && b.toString("latin1", 8, 12) === "WEBP") return "webp";
  return null; // includes HEIC/HEIF: the prebuilt sharp has no HEVC decoder
}

export async function prepareSelfie(buf: Buffer): Promise<{ raw: RawImage; modelJpeg: Buffer }> {
  if (buf.length === 0) throw new HttpError("empty_file", 400);
  if (buf.length > MAX_BYTES) throw new HttpError("file_too_large", 413);
  const format = sniff(buf);
  if (!format) throw new HttpError("unsupported_image_type", 415);

  let raw: RawImage;
  let modelJpeg: Buffer;
  try {
    const meta = await sharp(buf, { failOn: "error", limitInputPixels: MAX_PIXELS }).metadata();
    if (meta.format !== format) throw new HttpError("invalid_image", 400);
    const width = meta.autoOrient?.width ?? meta.width;
    const height = meta.autoOrient?.height ?? meta.height;
    if (!width || !height || Math.min(width, height) < MIN_SIDE || Math.max(width, height) > MAX_SIDE)
      throw new HttpError("image_dimensions", 422);

    const { data, info } = await sharp(buf, { failOn: "error", limitInputPixels: MAX_PIXELS })
      .rotate()
      .resize({ width: WORK_SIDE, height: WORK_SIDE, fit: "inside", withoutEnlargement: true })
      .removeAlpha()
      .toColourspace("srgb")
      .raw()
      .toBuffer({ resolveWithObject: true });
    raw = { data, width: info.width, height: info.height };
    // Encoded from the decoded pixels, so it carries no EXIF, GPS or other metadata.
    modelJpeg = await sharp(data, { raw: { width: info.width, height: info.height, channels: 3 } })
      .jpeg({ quality: 90 })
      .toBuffer();
  } catch (e) {
    if (e instanceof HttpError) throw e;
    // sharp reports limitInputPixels as an error mentioning the pixel limit.
    throw /pixel limit/i.test(String(e)) ? new HttpError("image_dimensions", 422) : new HttpError("invalid_image", 400);
  }
  return { raw, modelJpeg };
}

/** Long side of the stored profile photo: sharp on the full-width passport card at 3x. */
const PHOTO_SIDE = 480;

/** The profile photo as stored: upright, at most 480 px, a ~30 KB JPEG with no EXIF or GPS. */
export async function compactPhoto(buf: Buffer): Promise<Buffer> {
  if (buf.length === 0) throw new HttpError("empty_file", 400);
  if (buf.length > MAX_BYTES) throw new HttpError("file_too_large", 413);
  if (!sniff(buf)) throw new HttpError("unsupported_image_type", 415);
  try {
    return await sharp(buf, { failOn: "error", limitInputPixels: MAX_PIXELS })
      .rotate()
      .resize({ width: PHOTO_SIDE, height: PHOTO_SIDE, fit: "inside", withoutEnlargement: true })
      .removeAlpha()
      .toColourspace("srgb")
      .jpeg({ quality: 75, mozjpeg: true })
      .toBuffer();
  } catch (e) {
    throw /pixel limit/i.test(String(e)) ? new HttpError("image_dimensions", 422) : new HttpError("invalid_image", 400);
  }
}
