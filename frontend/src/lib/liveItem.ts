import type { CatalogProduct, FeedCategory } from "@/api/catalog";
import {
  findItem,
  type CatalogItem,
  type Category,
  type Length,
  type Silhouette,
  type Sleeve,
} from "@/data/catalog";
import type { ShopFor } from "@/store/profile";

export type EstimatedCut = Pick<
  CatalogItem,
  "category" | "silhouette" | "sleeve" | "length"
>;

const has = (text: string, pattern: RegExp) => pattern.test(text);

const HINT: Partial<Record<FeedCategory, Category>> = {
  tops: "top",
  bottoms: "bottom",
  jeans: "bottom",
  shorts: "bottom",
  dresses: "dress",
  outerwear: "outerwear",
};

function garment(t: string): Category | null {
  if (
    has(t, /\b(dress|gown)\b/) &&
    !has(t, /\bdress (shirt|pants?|trousers?)\b/)
  )
    return "dress";
  if (
    has(
      t,
      /\b(jacket|coat|blazer|parka|puffer|overshirt|shacket|trench|anorak|cardigan)\b/,
    )
  )
    return "outerwear";
  if (
    has(
      t,
      /\b(pants?|trousers?|jeans?|shorts|skirt|joggers?|chinos?|leggings?|sweatpants)\b/,
    )
  )
    return "bottom";
  if (
    has(
      t,
      /\b(shirt|t ?shirt|tee|top|blouse|sweater|hoodie|sweatshirt|tank|cami|polo|knit)\b/,
    )
  )
    return "top";
  return null;
}

function silhouette(t: string, category: Category): Silhouette {
  if (category === "bottom") {
    if (has(t, /\b(wide( leg)?|palazzo|flare|flared|bootcut|baggy)\b/))
      return "wide-leg";
    if (has(t, /\b(skinny|slim|tapered)\b/)) return "slim";
    if (has(t, /\bskirt\b/)) return has(t, /\bslip\b/) ? "slip" : "a-line";
    return "straight";
  }
  if (category === "dress") {
    if (has(t, /\bwrap\b/)) return "wrap";
    if (has(t, /\b(slip|cami)\b/)) return "slip";
    if (has(t, /\b(bodycon|fitted|sheath)\b/)) return "fitted";
    return "a-line";
  }
  if (category === "outerwear") {
    if (has(t, /\b(blazer|tailored|trench)\b/)) return "tailored";
    if (has(t, /\bwrap\b/)) return "wrap";
    if (has(t, /\b(boxy|oversized|puffer)\b/)) return "boxy";
    return "relaxed";
  }
  if (has(t, /\b(boxy|oversized)\b/)) return "boxy";
  if (has(t, /\bcrop(ped)?\b/)) return "cropped";
  if (has(t, /\bwrap\b/)) return "wrap";
  if (has(t, /\b(fitted|slim|bodysuit|tank|cami)\b/)) return "fitted";
  return "relaxed";
}

function length(t: string, category: Category): Length {
  if (category === "bottom") {
    if (has(t, /\bshorts\b/)) return "thigh";
    if (has(t, /\bskirt\b/))
      return has(t, /\bmini\b/)
        ? "thigh"
        : has(t, /\bmidi\b/)
          ? "midi"
          : has(t, /\bmaxi\b/)
            ? "ankle"
            : "knee";
    return has(t, /\b(capri|cropped)\b/) ? "midi" : "ankle";
  }
  if (category === "dress")
    return has(t, /\bmini\b/)
      ? "thigh"
      : has(t, /\bmidi\b/)
        ? "midi"
        : has(t, /\b(maxi|gown)\b/)
          ? "ankle"
          : "knee";
  if (has(t, /\bcrop(ped)?\b/)) return "waist";
  if (category === "outerwear")
    return has(t, /\b(coat|trench|parka|duster|long)\b/) ? "knee" : "hip";
  return has(t, /\b(tunic|longline)\b/) ? "thigh" : "hip";
}

function sleeve(t: string, category: Category): Sleeve | undefined {
  if (category === "bottom") return undefined;
  if (has(t, /\b(sleeveless|tank|cami|strapless|halter|tube|slip)\b/))
    return "none";
  if (has(t, /\b(short sleeve|t ?shirt|tee|polo)\b/)) return "short";
  return category === "dress" ? "short" : "long";
}

/**
 * Guesses the cut the mannequin needs from a listing title. Shopify doesn't
 * describe garment cuts, so this is an estimate and the item sheet says so.
 * shortcut: keyword rules on English titles; replace with real garment data
 * (or a licensed garment image for AI try-on) when one is available.
 */
export function inferCut(title: string, hint?: FeedCategory): EstimatedCut {
  const t = title.toLowerCase().replace(/[-_/]/g, " ");
  const category = garment(t) ?? (hint && HINT[hint]) ?? "top";
  return {
    category,
    silhouette: silhouette(t, category),
    sleeve: sleeve(t, category),
    length: length(t, category),
  };
}

/** Shopify cards are drawn 4:5 (portrait product shots); the API gives no image size. */
const LIVE_ASPECT = 1.25;

/**
 * A backend catalog product as the app's catalog item, so the feed, item
 * sheet, mannequin, saving and Shop work unchanged. Demo products (mock mode)
 * map back to the bundled item with its real cut.
 */
export function toCatalogItem(
  product: CatalogProduct,
  shopFor: ShopFor,
): CatalogItem {
  if (product.id.startsWith("demo:")) {
    const demo = findItem(product.id.slice("demo:".length));
    if (demo) return demo;
  }
  return {
    // The Shopify id's own token; GIDs have slashes, which don't belong in a route.
    id: `shopify-${product.id.split("/").pop()}`,
    name: product.title,
    brand: product.merchant.name,
    cut: shopFor === "both" ? "unisex" : shopFor,
    colors: colorOf(product),
    price: product.price ? product.price.minor / 100 : 0,
    priceLabel: product.price?.formatted ?? "See price at store",
    aspect: LIVE_ASPECT,
    sizeChartId: "",
    imageUrl: product.image?.url,
    productUrl: product.url,
    source: "shopify",
    ...(product.estimate && { evidence: product.estimate.evidence }),
    // The backend's reading of the full listing beats a guess from the title alone.
    ...(product.estimate?.cut ?? inferCut(product.title, product.category)),
  };
}

/** The AI's color unless it says it's guessing, else the swatch for the merchant's color name, else none. */
function colorOf({ estimate, color }: CatalogProduct): string[] {
  if (estimate?.hex && estimate.confidence !== "low") return [estimate.hex];
  return color?.hex ? [color.hex] : [];
}
