import { z } from "zod";
import type { Insight } from "../services/listingInsights.ts";
import { colorFromName } from "./colors.ts";
import type { Category } from "./query.ts";

// What we read from a Shopify catalog product. Everything but the id, title and
// one linkable variant is optional: listings vary a lot between merchants.
const https = z.url({ protocol: /^https$/ });
const Money = z.object({ amount: z.number().int().min(0), currency: z.string().regex(/^[A-Z]{3}$/) });
const Choice = z.object({ name: z.string(), label: z.string() });
const RawVariant = z.object({
  id: z.string(),
  title: z.string().optional(),
  url: https.optional(),
  price: Money.optional(),
  availability: z.object({ available: z.boolean() }).optional(),
  options: z.array(Choice).optional(),
  seller: z.object({ name: z.string().optional(), url: https.optional() }).optional(),
});
const RawProduct = z.object({
  id: z.string().regex(/^gid:\/\/shopify\//),
  title: z.string().min(1),
  description: z.object({ plain: z.string().optional(), html: z.string().optional() }).optional(),
  media: z.array(z.object({ type: z.string(), url: https, alt_text: z.string().optional() })).optional(),
  options: z.array(z.object({ name: z.string(), values: z.array(z.object({ label: z.string(), available: z.boolean().optional() })) })).optional(),
  variants: z.array(RawVariant).min(1),
  price_range: z.object({ min: Money }).optional(),
  rating: z.object({ value: z.number(), scale_max: z.number(), count: z.number() }).optional(),
  selected: z.array(Choice).optional(),
  metadata: z.object({ top_features: z.array(z.string()).optional(), tech_specs: z.array(z.string()).optional() }).optional(),
});

export type Price = { minor: number; currency: string; formatted: string };
export type CatalogProduct = {
  /** Shopify product GID; pass it back to /catalog/product. */
  id: string;
  /** The variant this card shows; `url`, `price` and `color` are this variant's. */
  variantId: string;
  title: string;
  /** The merchant's own product page, as Shopify supplied it. */
  url: string;
  merchant: { name: string; url?: string };
  image: { url: string; alt: string } | null;
  price: Price | null;
  category?: Category;
  /**
   * The merchant's color name for this variant ("variant") or a color word in
   * the title ("title"). `hex` is an approximate swatch for the name, null
   * when the name is not a known color word. Never measured from the image.
   */
  color: { name: string; hex: string | null; source: "variant" | "title" } | null;
  options: { name: string; values: { label: string; available?: boolean }[] }[];
  /** Labels of the merchant's size options (S, M, 32"...). Not garment measurements. */
  sizes: string[];
  /** The option choices that make up the shown variant. */
  selected: { name: string; label: string }[];
  available: boolean;
  rating?: { value: number; max: number; count: number };
  /**
   * Gemini's reading of the listing text (never images): the garment's main
   * color, its cut, and the words it went on. An estimate, not a measurement.
   */
  estimate?: Insight & { source: "ai" };
  // Detail only:
  images?: { url: string; alt: string }[];
  description?: string;
  variants?: { id: string; title: string; url: string; price: Price | null; available: boolean; options: { name: string; label: string }[] }[];
};

const isColor = (name: string) => /colou?r/i.test(name);

/** Shopify amounts are in the currency's minor unit; JPY has none, USD has two. */
function price(money: z.infer<typeof Money> | undefined): Price | null {
  if (!money) return null;
  try {
    const format = new Intl.NumberFormat("en-US", { style: "currency", currency: money.currency });
    const digits = format.resolvedOptions().maximumFractionDigits ?? 2;
    return { minor: money.amount, currency: money.currency, formatted: format.format(money.amount / 10 ** digits) };
  } catch {
    return null; // a currency code Intl doesn't know
  }
}

/** Descriptions arrive as HTML even in `plain`; the app shows text. */
function toText(html: string): string {
  return html
    .replace(/<(br|\/p|\/li|\/div|\/h\d)[^>]*>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim()
    .slice(0, 2000);
}

/**
 * A Shopify catalog product as the app's product, or null when it can't be
 * shown honestly: no id, no title, or no variant with a merchant URL to send
 * the shopper to. Links are only ever Shopify-supplied URLs.
 */
export function normalizeProduct(raw: unknown, category?: Category, opts: { detail?: boolean } = {}): CatalogProduct | null {
  const parsed = RawProduct.safeParse(raw);
  if (!parsed.success) return null;
  const p = parsed.data;
  const shown = p.variants.find((v) => v.url);
  if (!shown?.url) return null;

  const variantColor = shown.options?.find((o) => isColor(o.name))?.label;
  const titleColor = variantColor ? null : colorFromName(p.title);
  const color = variantColor
    ? { name: variantColor, hex: colorFromName(variantColor)?.hex ?? null, source: "variant" as const }
    : titleColor && { name: titleColor.name, hex: titleColor.hex, source: "title" as const };

  const images = (p.media ?? []).filter((m) => m.type === "image").map((m) => ({ url: m.url, alt: m.alt_text || p.title }));
  const options = (p.options ?? []).map((o) => ({
    name: o.name,
    values: o.values.map((v) => (v.available === undefined ? { label: v.label } : { label: v.label, available: v.available })),
  }));

  const product: CatalogProduct = {
    id: p.id,
    variantId: shown.id,
    title: p.title,
    url: shown.url,
    merchant: { name: shown.seller?.name ?? new URL(shown.url).hostname, ...(shown.seller?.url && { url: shown.seller.url }) },
    image: images[0] ?? null,
    price: price(shown.price ?? p.price_range?.min),
    ...(category && { category }),
    color,
    options,
    sizes: [...new Set(options.filter((o) => /size/i.test(o.name)).flatMap((o) => o.values.map((v) => v.label)))],
    selected: (opts.detail && p.selected) || shown.options || [],
    // The search asks for available items only, so a listing that doesn't say is treated as available.
    available: shown.availability?.available ?? true,
    ...(p.rating && { rating: { value: p.rating.value, max: p.rating.scale_max, count: p.rating.count } }),
  };
  if (!opts.detail) return product;

  const text = p.description?.plain ?? p.description?.html;
  return {
    ...product,
    images,
    ...(text && { description: toText(text) }),
    variants: p.variants.flatMap((v) =>
      v.url
        ? [{ id: v.id, title: v.title ?? p.title, url: v.url, price: price(v.price), available: v.availability?.available ?? true, options: v.options ?? [] }]
        : [],
    ),
  };
}

/** What a shopper would read on the listing: the text Gemini estimates color and cut from. No links or images. */
export type ListingFacts = {
  title: string;
  color?: string;
  options?: Record<string, string[]>;
  description?: string;
  features?: string[];
  /** Shopify's labeled specs ("Fit: Relaxed", "Length: Mini"), minus care and sizing lines. */
  specs?: string[];
};

export function listingFacts(raw: unknown): ListingFacts | null {
  const parsed = RawProduct.safeParse(raw);
  if (!parsed.success) return null;
  const p = parsed.data;
  const shown = p.variants.find((v) => v.url) ?? p.variants[0];
  const color = shown.options?.find((o) => isColor(o.name))?.label;
  // Sizes say nothing about cut; fit, length, rise and sleeve options do.
  const options = Object.fromEntries(
    (p.options ?? []).filter((o) => /fit|length|rise|sleeve|cut/i.test(o.name)).map((o) => [o.name, o.values.slice(0, 6).map((v) => v.label)]),
  );
  const text = p.description?.plain ?? p.description?.html;
  const features = p.metadata?.top_features?.slice(0, 3).map((f) => f.slice(0, 120));
  const specs = p.metadata?.tech_specs
    ?.filter((line) => !/^(care|available|size)/i.test(line))
    .slice(0, 8)
    .map((line) => line.slice(0, 100));
  return {
    title: p.title,
    ...(color && { color }),
    ...(Object.keys(options).length && { options }),
    ...(text && { description: toText(text).slice(0, 300) }),
    ...(features?.length && { features }),
    ...(specs?.length && { specs }),
  };
}
