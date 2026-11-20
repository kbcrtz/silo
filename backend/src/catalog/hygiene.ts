import type { CatalogProduct } from "./normalize.ts";

/**
 * Listings the feed never shows, whatever the search: counterfeits, resale
 * and keyword-stuffed dropship titles, which live checks found even under
 * Shopify's `condition: ["new"]` filter, and prices in another currency
 * (7.5% of listings in a US check, with Intl's display digits mis-scaling
 * some, e.g. PKR). "Sexy" and similar words are legitimate retail and stay.
 */
const COUNTERFEIT = /\b(reps|replicas?|AAA)\b|\b1:1\b/i;
const RESALE = /\b(NWT|NWOT|EUC|pre-?owned|pre-?loved|thrift(ed)?|second-?hand)\b|\bsz\.?\s*(\d+|[xsml]{1,3}|\d?xl)\b/i;
/** A title ending on one size ("…jacket, white. Women's M") is a single used item. */
const ONE_SIZE = /\b(wom[ae]n['’]?s|men['’]?s|size)\s+(XXS|XS|S|M|L|XL|XXL|\d?XL|\d{1,2})\.?\s*$/i;
/** Resale shops by name ("Rewear", "…Consignment"). */
const RESALE_STORE = /\b(re-?wear|resale|consign\w*|thrift\w*|pre-?loved|second-?hand)\b/i;
/** "S-XXL", "M~3XL": one listing for every size is a dropship tell. */
const SIZE_RANGE = /\b(XXS|XS|S|M)\s*[-–~]\s*\d?X{1,3}L\b/i;
const COLOR_WORDS = /\b(black|white|red|blue|green|yellow|pink|purple|orange|brown|gr[ae]y|beige|navy|khaki|cream|ivory|olive|burgundy|tan|teal|camel|maroon)\b/gi;
const MAX_TITLE = 100;

/** The currency a ships-to country's prices should be in; unknown countries aren't checked. */
const CURRENCY: Record<string, string> = { US: "USD", CA: "CAD", GB: "GBP", AU: "AUD" };

/** Why a listing is left out of the feed, or null to keep it. */
export function junkReason(p: Pick<CatalogProduct, "title" | "merchant" | "price">, country?: string): string | null {
  const text = `${p.title} ${p.merchant.name}`;
  if (COUNTERFEIT.test(text)) return "counterfeit";
  if (RESALE.test(p.title) || ONE_SIZE.test(p.title) || RESALE_STORE.test(p.merchant.name)) return "resale";
  if (p.title.length > MAX_TITLE || SIZE_RANGE.test(p.title)) return "stuffed";
  if (new Set((p.title.match(COLOR_WORDS) ?? []).map((w) => w.toLowerCase().replace("grey", "gray"))).size >= 3) return "stuffed";
  const currency = country ? CURRENCY[country] : undefined;
  if (currency && p.price && p.price.currency !== currency) return "currency";
  return null;
}
