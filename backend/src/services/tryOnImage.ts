import type postgres from "postgres";
import sharp from "sharp";
import { z } from "zod";
import { HttpError } from "../errors.ts";
import { providerError } from "./colorVision.ts";

export type Department = "womens" | "mens" | "both";
type Garment = "top" | "bottom" | "dress" | "outerwear";

/** Bumped when the template changes, so saved images from an older one aren't served. */
export const TEMPLATE_VERSION = 4;

const NOUN: Record<Garment, string> = { top: "top", bottom: "bottoms", outerwear: "jacket or coat", dress: "dress" };

const STUDIO = "standing straight with arms relaxed at its sides, framed from the top of the head to the feet, on a seamless pure white (#FFFFFF) background with no floor line, no shadow and no vignette, soft even studio lighting.";
const formOf = (department: Department) => (department === "womens" ? "female" : department === "mens" ? "male" : "gender-neutral");
/** The mannequin with the diagram's body, for prompts with a body guide as image 1. */
const shapedMannequin = (department: Department) =>
  `A clean full-body studio product photo for a fashion app's try-on view: a matte light-gray, faceless ${formOf(department)} dress-form mannequin, a solid 3D figure with soft studio shading, whose body has exactly the silhouette in image 1: the same shoulder, chest, waist, hip, thigh and leg widths relative to its height, and the same leg length. Do not slim, lengthen or idealize the body: a fuller body stays fuller, a petite body stays petite. Front view, ${STUDIO}`;
// Naming the product helps the model pick the right piece from a photo with other clothes in it.
const quoted = (title: string) => `("${title.replace(/["\n]/g, "").slice(0, 120)}")`;

/**
 * The fixed prompt every try-on image uses, so all products come out in one
 * consistent studio style: a full-body faceless mannequin wearing only the
 * item from the store photo, bare everywhere else (a shirt leaves the legs
 * bare, trousers the chest). With `build` (the body guide's words), image 1 is
 * the shopper's body diagram and image 2 the store photo; the body comes from
 * the diagram, the garment's look and cut from the photo.
 */
export function tryOnPrompt({ category, department, cut, title, build }: { category: Garment; department: Department; cut?: string; title?: string; build?: string }): string {
  const noun = NOUN[category];
  const named = title ? ` ${quoted(title)}` : "";
  return [
    ...(build
      ? [
          `Image 1 is a body diagram, not a picture: the flat pale-blue silhouette is one specific person's body, ${build}. Image 2 is a store photo of a product${named}.`,
          shapedMannequin(department),
          `The mannequin wears ONLY the ${noun} from image 2. It keeps the colors, pattern, fabric, neckline, collar, pockets, buttons, cut, length and every other detail of its photo, sized to this body: fitted pieces follow its curves, loose pieces hang from it. Ignore the person, pose, background and any other clothing in the store photo.`,
        ]
      : [
          "A clean full-body studio product photo for a fashion app's try-on view.",
          `A matte light-gray, faceless ${formOf(department)} dress-form mannequin, front view, ${STUDIO}`,
          `The mannequin wears ONLY the ${noun} from the store photo. Reproduce it faithfully: the same colors, pattern, fabric, collar, pockets, buttons, sleeve length and overall length${cut ? `, worn as ${cut}` : ""}. Ignore the person, pose, background and any other clothing in the store photo.`,
        ]),
    `Everywhere the ${noun} doesn't cover, the mannequin is bare: smooth matte light-gray mannequin surface, with no other clothing, no shoes and nothing else.`,
    ...(build ? ["Never copy the diagram's flat style or its blue color: the mannequin is a shaded 3D light-gray figure."] : []),
    "No text, no watermarks, no accessories, no people.",
  ].join("\n");
}

/** Bumped when the full-fit template changes. */
export const FIT_VERSION = 1;
/** Inner layers first, so the jacket comes last and is worn over them. */
export const FIT_ORDER: Garment[] = ["top", "bottom", "dress", "outerwear"];

/**
 * One image of a whole fit (2 or 3 pieces, in FIT_ORDER) on the shopper's
 * body: image 1 is the body diagram, then one store photo per piece. Each
 * photo is named by its listing title, which stopped the model taking a
 * color from the wrong photo in testing.
 */
export function fitPrompt({ pieces, department, build }: { pieces: { category: Garment; title: string }[]; department: Department; build: string }): string {
  const image = (i: number) => `image ${i + 2}`;
  const under = pieces.find((p) => p.category === "top" || p.category === "dress")?.category;
  const photos = pieces.map((p, i) => `${image(i)} is the ${NOUN[p.category]} ${quoted(p.title)}`).join(", ");
  const wear = pieces.map((p, i) => `the ${NOUN[p.category]} from ${image(i)}${p.category === "outerwear" && under ? `, worn open over the ${under}` : ""}`).join(", ");
  return [
    `Image 1 is a body diagram, not a picture: the flat pale-blue silhouette is one specific person's body, ${build}. Images 2 to ${pieces.length + 1} are store photos of products: ${photos}.`,
    shapedMannequin(department),
    `The mannequin wears ONLY these pieces together as one outfit: ${wear}. Each piece keeps the colors, pattern, fabric, neckline, collar, pockets, buttons, cut, length and every other detail of its own photo, sized to this body: fitted pieces follow its curves, loose pieces hang from it. Never swap colors or details between pieces. Ignore the people, poses, backgrounds and any other clothing in the store photos.`,
    "Everywhere the outfit doesn't cover, the mannequin is bare: smooth matte light-gray mannequin surface, with no other clothing, no shoes and nothing else.",
    "Never copy the diagram's flat style or its blue color: the mannequin is a shaded 3D light-gray figure.",
    "No text, no watermarks, no accessories, no people.",
  ].join("\n");
}

/** An outline of [x, y] points in cm from the top of the head, x = 0 down the middle. */
const Outline = z.array(z.tuple([z.number().min(-150).max(150), z.number().min(-10).max(260)])).min(3).max(300);
/** The app's drawn mannequin body: the head, then everything below it, between 1 and 2.5 m tall. */
export const Guide = z.strictObject({ body: z.tuple([Outline, Outline]) }).refine(({ body }) => {
  const height = Math.max(...body[1].map((p) => p[1]));
  return height >= 100 && height <= 250;
});
export type Guide = z.infer<typeof Guide>;

/**
 * The body's build in words, which the model follows more reliably than the
 * diagram alone: from the silhouette's area over its height squared (the
 * app's figures run from about 0.14 for slim to 0.23 for very full), and its
 * height for petite or tall.
 */
export function bodyWords(guide: Guide): string {
  const pts = guide.body[1];
  const height = Math.max(...pts.map((p) => p[1]));
  let twice = 0;
  for (let i = 0; i < pts.length; i++) {
    const [p, q] = [pts[i], pts[(i + 1) % pts.length]];
    twice += p[0] * q[1] - q[0] * p[1];
  }
  const index = Math.abs(twice) / 2 / height ** 2;
  const size = height < 160 ? "petite, " : height > 180 ? "tall, " : "";
  const build =
    index < 0.15
      ? "slender body: narrow shoulders, a slim waist, slim hips and legs"
      : index < 0.172
        ? "average body"
        : index < 0.185
          ? "fuller, curvy body: a full chest, a soft waist, wide hips and full thighs"
          : "plus-size, full-figured body: broad shoulders, a full chest, a wide waist, wide hips and full thighs";
  const words = size + build;
  return `${/^[aeiou]/.test(words) ? "an" : "a"} ${words}`;
}

/**
 * The body as a flat pale-blue silhouette on white for Gemini (straight lines
 * between the app's points: smooth enough for a diagram). Filled, so its
 * widths read at a glance; blue with no outline, so it can't pass for the gray
 * mannequin and get copied flat. Clothes aren't drawn: they would hide the
 * body, and the model copied their outlines.
 */
export async function guideImage(guide: Guide): Promise<Buffer> {
  const W = 768, H = 1024;
  const all = guide.body.flat();
  const xs = all.map((q) => q[0]), maxY = Math.max(...all.map((q) => q[1]));
  const s = Math.min((H * 0.92) / maxY, (W * 0.9) / (Math.max(...xs) - Math.min(...xs)));
  const ox = W / 2 - ((Math.min(...xs) + Math.max(...xs)) / 2) * s;
  const at = (x: number, y: number) => `${(x * s + ox).toFixed(1)},${(y * s + H * 0.04).toFixed(1)}`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="100%" height="100%" fill="#fff"/>
<g fill="#c4daf4">${guide.body.map((o) => `<path d="M${o.map(([x, y]) => at(x, y)).join("L")}Z"/>`).join("")}</g></svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

/**
 * Gemini sometimes paints a light-gray or vignetted backdrop instead of white.
 * Flood-fills from the border through pixels near the border's color (and
 * each step near its neighbor, so the fill stops at the mannequin's edge),
 * turning the backdrop pure white for the app's white card.
 */
export async function whiteBackground(image: Buffer): Promise<Buffer> {
  const { data, info } = await sharp(image).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H } = info;
  const border: number[] = [];
  for (let x = 0; x < W; x++) border.push(x, (H - 1) * W + x);
  for (let y = 1; y < H - 1; y++) border.push(y * W, y * W + W - 1);
  const median = (c: number) => border.map((p) => data[p * 3 + c]).sort((a, b) => a - b)[border.length >> 1];
  const ref = [median(0), median(1), median(2)];
  if (Math.min(...ref) < 200) return image; // not a light studio backdrop: leave it alone
  const near = (p: number, q: number[], tol: number) =>
    Math.abs(data[p * 3] - q[0]) <= tol && Math.abs(data[p * 3 + 1] - q[1]) <= tol && Math.abs(data[p * 3 + 2] - q[2]) <= tol;
  const seen = new Uint8Array(W * H);
  const stack: number[] = [];
  for (const p of border) if (!seen[p] && near(p, ref, 24)) (seen[p] = 1), stack.push(p);
  while (stack.length) {
    const p = stack.pop()!;
    const color = [data[p * 3], data[p * 3 + 1], data[p * 3 + 2]];
    const x = p % W;
    for (const q of [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, p - W, p + W]) {
      if (q < 0 || q >= W * H || seen[q] || !near(q, color, 6) || !near(q, ref, 24)) continue;
      seen[q] = 1;
      stack.push(q);
    }
  }
  for (let p = 0; p < W * H; p++) if (seen[p]) data[p * 3] = data[p * 3 + 1] = data[p * 3 + 2] = 255;
  return sharp(data, { raw: { width: W, height: H, channels: 3 } }).jpeg({ quality: 90 }).toBuffer();
}

/** The only host product photos are fetched from: Shopify's image CDN, over https. */
export function photoUrlAllowed(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.hostname === "cdn.shopify.com";
  } catch {
    return false;
  }
}

export type Photo = { data: Buffer; mimeType: string };
export type TryOnStore = {
  get(key: string): Promise<Buffer | null>;
  put(key: string, image: Buffer, model: string): Promise<void>;
};
export type TryOn = {
  fetchPhoto(url: string): Promise<Photo>;
  /** `photos`: one store photo per piece. `guide`: the body guide PNG, sent as image 1. */
  generate(photos: Photo[], prompt: string, guide?: Buffer): Promise<Buffer>;
  store: TryOnStore;
};

const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

type GenerateContent = (request: Record<string, unknown>) => Promise<{ candidates?: { content?: { parts?: { inlineData?: { data?: string } }[] } }[] }>;

export function createTryOn(opts: { generateContent: GenerateContent; model: string; timeoutMs: number; fetch: typeof fetch; store: TryOnStore }): TryOn {
  return {
    store: opts.store,
    async fetchPhoto(url) {
      if (!photoUrlAllowed(url)) throw new HttpError("no_photo", 422);
      const sized = new URL(url);
      sized.searchParams.set("width", "1024"); // Shopify's CDN resizes; a phone-sized photo is plenty
      const res = await opts.fetch(sized, { signal: AbortSignal.timeout(10_000) }).catch(() => null);
      const type = res?.headers.get("content-type") ?? "";
      if (!res?.ok || !type.startsWith("image/")) throw new HttpError("no_photo", 422);
      const data = Buffer.from(await res.arrayBuffer());
      if (data.length > MAX_PHOTO_BYTES) throw new HttpError("no_photo", 422);
      return { data, mimeType: type.split(";")[0] };
    },
    async generate(photos, prompt, guide) {
      // The body diagram goes first: placed after the photos, the model paid it less attention.
      const images = [...(guide ? [{ data: guide, mimeType: "image/png" }] : []), ...photos];
      const request = {
        model: opts.model,
        contents: [{ role: "user", parts: [...images.map((i) => ({ inlineData: { mimeType: i.mimeType, data: i.data.toString("base64") } })), { text: prompt }] }],
      };
      // Gemini now and then answers without an image (finish reason NO_IMAGE); the same request usually works the second time.
      for (let attempt = 1; ; attempt++) {
        let res;
        try {
          res = await opts.generateContent({ ...request, config: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: "3:4" }, abortSignal: AbortSignal.timeout(opts.timeoutMs) } });
        } catch (e) {
          throw providerError(e);
        }
        const data = res.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data)?.inlineData?.data;
        if (data) return whiteBackground(Buffer.from(data, "base64"));
        if (attempt === 2) throw new HttpError("gemini_invalid_output", 502);
      }
    },
  };
}

/** Process memory, for running without a database. */
export function memoryStore(): TryOnStore {
  const images = new Map<string, Buffer>();
  return {
    async get(key) {
      return images.get(key) ?? null;
    },
    async put(key, image) {
      images.set(key, image);
    },
  };
}

/** Generated images saved in Postgres, so each product and department is generated once. */
export function postgresStore(sql: postgres.Sql): TryOnStore {
  return {
    async get(key) {
      const [row] = await sql<{ image: Buffer }[]>`SELECT image FROM tryon_images WHERE key = ${key}`;
      return row?.image ?? null;
    },
    async put(key, image, model) {
      await sql`INSERT INTO tryon_images (key, model, image) VALUES (${key}, ${model}, ${image})
        ON CONFLICT (key) DO UPDATE SET image = EXCLUDED.image, model = EXCLUDED.model, created_at = now()`;
    },
  };
}
