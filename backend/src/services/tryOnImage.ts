import type postgres from "postgres";
import { HttpError } from "../errors.ts";
import { providerError } from "./colorVision.ts";

export type Department = "womens" | "mens" | "both";
type Garment = "top" | "bottom" | "dress" | "outerwear";

/** Bumped when the template changes, so saved images from an older one aren't served. */
export const TEMPLATE_VERSION = 3;

const NOUN: Record<Garment, string> = { top: "top", bottom: "bottoms", outerwear: "jacket or coat", dress: "dress" };

/**
 * The fixed prompt every try-on image uses, so all products come out in one
 * consistent studio style: a full-body faceless mannequin wearing only the
 * item from the store photo, bare everywhere else (a shirt leaves the legs
 * bare, trousers the chest).
 */
export function tryOnPrompt({ category, department, cut }: { category: Garment; department: Department; cut?: string }): string {
  const form = department === "womens" ? "female" : department === "mens" ? "male" : "gender-neutral";
  const noun = NOUN[category];
  return [
    "A clean full-body studio product photo for a fashion app's try-on view.",
    `A matte light-gray, faceless ${form} dress-form mannequin, front view, standing straight with arms relaxed at its sides, framed from the top of the head to the feet, on a seamless pure white (#FFFFFF) background with no floor line, no shadow and no vignette, soft even studio lighting.`,
    `The mannequin wears ONLY the ${noun} from the store photo. Reproduce it faithfully: the same colors, pattern, fabric, collar, pockets, buttons, sleeve length and overall length${cut ? `, worn as ${cut}` : ""}. Ignore the person, pose, background and any other clothing in the store photo.`,
    `Everywhere the ${noun} doesn't cover, the mannequin is bare: smooth matte light-gray mannequin surface, with no other clothing, no shoes and nothing else.`,
    "No text, no watermarks, no accessories, no people.",
  ].join("\n");
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
  generate(photo: Photo, prompt: string): Promise<Buffer>;
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
    async generate(photo, prompt) {
      let res;
      try {
        res = await opts.generateContent({
          model: opts.model,
          contents: [{ role: "user", parts: [{ inlineData: { mimeType: photo.mimeType, data: photo.data.toString("base64") } }, { text: prompt }] }],
          config: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: "3:4" }, abortSignal: AbortSignal.timeout(opts.timeoutMs) },
        });
      } catch (e) {
        throw providerError(e);
      }
      const data = res.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data)?.inlineData?.data;
      if (!data) throw new HttpError("gemini_invalid_output", 502);
      return Buffer.from(data, "base64");
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

export async function migrateTryOn(sql: postgres.Sql) {
  await sql`CREATE TABLE IF NOT EXISTS tryon_images (
    key text PRIMARY KEY,
    model text NOT NULL,
    image bytea NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  )`;
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
