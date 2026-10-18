import { CATALOG, shopUrl, type CatalogItem } from "@/data/catalog";
import type { Season } from "@/data/seasons";
import type { ShopFor } from "@/store/profile";
import { API_URL, USE_MOCKS, apiHeaders, expectOk, sleep } from "./config";

export type FeedCategory =
  | "for-you"
  | "all"
  | "tops"
  | "bottoms"
  | "jeans"
  | "shorts"
  | "sweats"
  | "dresses"
  | "outerwear";
export type FashionStyle = "minimal" | "colorful" | "dark" | "none";
export type Price = { minor: number; currency: string; formatted: string };
export type Choice = { name: string; label: string };

/** A live listing, normalized by the backend. See backend/README.md. */
export type CatalogProduct = {
  /** Shopify product id; pass it to getCatalogProduct. */
  id: string;
  variantId: string;
  title: string;
  /** The merchant's own product page. */
  url: string;
  merchant: { name: string; url?: string };
  image: { url: string; alt: string } | null;
  price: Price | null;
  category?: FeedCategory;
  /** A color name, with an approximate swatch only when the name is a known color word. */
  color: {
    name: string;
    hex: string | null;
    source: "variant" | "title";
  } | null;
  options: { name: string; values: { label: string; available?: boolean }[] }[];
  /** Size labels as the merchant lists them; not garment measurements. */
  sizes: string[];
  selected: Choice[];
  available: boolean;
  rating?: { value: number; max: number; count: number };
  /** The backend's AI reading of the listing text (never images): estimated color and cut, with the words it used. */
  estimate?: {
    hex: string | null;
    confidence: "high" | "medium" | "low";
    cut: Pick<CatalogItem, "category" | "silhouette" | "length" | "sleeve">;
    evidence: string;
    source: "ai";
  };
  images?: { url: string; alt: string }[];
  description?: string;
  variants?: {
    id: string;
    title: string;
    url: string;
    price: Price | null;
    available: boolean;
    options: Choice[];
  }[];
};

/** "demo" pages come from the bundled fixture catalog, never from Shopify. */
export type DiscoverPage = {
  products: CatalogProduct[];
  cursor: string | null;
  source: "shopify" | "demo";
};

export type DiscoverParams = {
  category: FeedCategory;
  q?: string;
  shopFor: ShopFor;
  style: FashionStyle;
  season?: Season | null;
  /** Whole dollars. */
  priceMin?: number;
  priceMax?: number;
  cursor?: string;
};

/**
 * One page of the Discover feed. Only fashion attributes leave the phone:
 * category, search text, department, style and the season's palette colors.
 *
 * Backend contract: GET {API_URL}/catalog/discover, Authorization: Bearer, ?category&q&shopFor&style
 * &palette=#hex,…&neutrals=#hex,…&priceMin&priceMax&cursor
 * -> { products, cursor, source }
 */
export async function discoverProducts(
  params: DiscoverParams,
  signal?: AbortSignal,
): Promise<DiscoverPage> {
  if (USE_MOCKS) return mockDiscover(params);
  const query = new URLSearchParams({
    category: params.category,
    shopFor: params.shopFor,
    style: params.style,
  });
  if (params.q) query.set("q", params.q);
  if (params.season) {
    query.set("palette", params.season.best.join(","));
    query.set("neutrals", params.season.neutrals.join(","));
  }
  if (params.priceMin !== undefined)
    query.set("priceMin", String(params.priceMin));
  if (params.priceMax !== undefined)
    query.set("priceMax", String(params.priceMax));
  if (params.cursor) query.set("cursor", params.cursor);
  const res = await fetch(`${API_URL}/catalog/discover?${query}`, {
    headers: apiHeaders(),
    signal,
  }).then(expectOk);
  return res.json();
}

/**
 * Full listing for the item screen. `selected` is the card's own option
 * choices, so the detail opens on the variant the card showed.
 *
 * Backend contract: GET {API_URL}/catalog/product?id&selected=<JSON>
 * -> { product }; 404 { error: "product_not_found" }
 */
export async function getCatalogProduct(
  id: string,
  selected?: Choice[],
  signal?: AbortSignal,
): Promise<CatalogProduct> {
  if (USE_MOCKS) {
    const item = CATALOG.find((i) => `demo:${i.id}` === id);
    if (!item) throw new Error("404 product_not_found");
    return toDemoProduct(item);
  }
  const query = new URLSearchParams({ id });
  if (selected?.length) query.set("selected", JSON.stringify(selected));
  const res = await fetch(`${API_URL}/catalog/product?${query}`, {
    headers: apiHeaders(),
    signal,
  }).then(expectOk);
  return (await res.json()).product;
}

// Mock: the bundled demo catalog as one page, labeled "demo".
const DEMO_CATEGORY: Record<CatalogItem["category"], FeedCategory> = {
  top: "tops",
  bottom: "bottoms",
  dress: "dresses",
  outerwear: "outerwear",
};

function toDemoProduct(item: CatalogItem): CatalogProduct {
  return {
    id: `demo:${item.id}`,
    variantId: `demo:${item.id}`,
    title: item.name,
    url: shopUrl(item),
    merchant: { name: item.brand },
    image: item.imageUrl ? { url: item.imageUrl, alt: item.name } : null,
    price: {
      minor: item.price * 100,
      currency: "USD",
      formatted: `$${item.price}`,
    },
    category: DEMO_CATEGORY[item.category],
    color: {
      name: item.name.split(" ")[0],
      hex: item.colors[0],
      source: "variant",
    },
    options: [],
    sizes: [],
    selected: [],
    available: true,
  };
}

async function mockDiscover(params: DiscoverParams): Promise<DiscoverPage> {
  await sleep(300);
  const q = params.q?.toLowerCase();
  const products = CATALOG.filter(
    (i) =>
      params.shopFor === "both" ||
      i.cut === "unisex" ||
      i.cut === params.shopFor,
  )
    .map(toDemoProduct)
    .filter(
      (p) =>
        params.category === "for-you" ||
        params.category === "all" ||
        p.category === params.category,
    )
    .filter((p) => !q || p.title.toLowerCase().includes(q));
  return { products, cursor: null, source: "demo" };
}
