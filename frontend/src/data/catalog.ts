export type Category = "top" | "bottom" | "dress" | "outerwear";
export type Cut = "womens" | "mens" | "unisex";
export type Silhouette =
  | "fitted"
  | "relaxed"
  | "boxy"
  | "wrap"
  | "tailored"
  | "cropped"
  | "slip"
  | "a-line"
  | "slim"
  | "straight"
  | "wide-leg";
export type Sleeve = "none" | "short" | "long";
export type Length = "waist" | "hip" | "thigh" | "knee" | "midi" | "ankle";
export type Detail =
  "placket" | "belt" | "ribbing" | "lapels" | "crease" | "pleats";

export type CatalogItem = {
  id: string;
  name: string;
  brand: string;
  category: Category;
  cut: Cut;
  /** Dominant colors, most prominent first. Used for palette matching. */
  colors: string[];
  price: number;
  /** Height / width of the card in the feed, for the masonry layout. */
  aspect: number;
  sizeChartId: string;
  /** Remote product photo. Cards fall back to a color block without one. */
  imageUrl?: string;
  /** Retailer page; affiliate tagging happens server side later. */
  productUrl?: string;
  /** The cut, which is what silhouette ranking and the mannequin go by. */
  silhouette: Silhouette;
  /** Tops, dresses and outerwear only. Defaults to long. */
  sleeve?: Sleeve;
  /** Where the hem lands on the body. */
  length: Length;
  /** Construction lines the mannequin draws on the garment. */
  details?: Detail[];
  /** Price as the merchant lists it, in its own currency; shown instead of `price`. */
  priceLabel?: string;
  /** A live Shopify listing; its cut is estimated from the title (lib/liveItem). */
  source?: "shopify";
  /** The listing's own words the backend's AI based color and cut on. */
  evidence?: string;
  /** Popular with the shopper's season this week (from the backend). */
  popular?: boolean;
};

/** Placeholder catalog spread across all twelve seasons. Brands are fictional. */
export const CATALOG: CatalogItem[] = [
  {
    id: "w-01",
    name: "Sage linen button-up",
    brand: "Fernhill",
    category: "top",
    cut: "womens",
    colors: ["#9CAF88"],
    price: 58,
    aspect: 1.3,
    silhouette: "relaxed",
    sleeve: "long",
    length: "hip",
    details: ["placket"],
    sizeChartId: "womens-tops",
  },
  {
    id: "w-02",
    name: "Camel wrap coat",
    brand: "Ostra",
    category: "outerwear",
    cut: "womens",
    colors: ["#C19A6B"],
    price: 189,
    aspect: 1.6,
    silhouette: "wrap",
    sleeve: "long",
    length: "knee",
    details: ["belt"],
    sizeChartId: "womens-tops",
  },
  {
    id: "w-03",
    name: "Rust midi slip dress",
    brand: "Calla",
    category: "dress",
    cut: "womens",
    colors: ["#B5541C"],
    price: 96,
    aspect: 1.5,
    silhouette: "slip",
    sleeve: "none",
    length: "midi",
    sizeChartId: "womens-dresses",
  },
  {
    id: "w-04",
    name: "Powder blue knit",
    brand: "Mire",
    category: "top",
    cut: "womens",
    colors: ["#A7C7E7"],
    price: 64,
    aspect: 1.1,
    silhouette: "fitted",
    sleeve: "long",
    length: "hip",
    details: ["ribbing"],
    sizeChartId: "womens-tops",
  },
  {
    id: "w-05",
    name: "Fuchsia satin blouse",
    brand: "Velo",
    category: "top",
    cut: "womens",
    colors: ["#E6007E"],
    price: 72,
    aspect: 1.2,
    silhouette: "wrap",
    sleeve: "long",
    length: "hip",
    sizeChartId: "womens-tops",
  },
  {
    id: "w-06",
    name: "Emerald wide-leg trouser",
    brand: "Ostra",
    category: "bottom",
    cut: "womens",
    colors: ["#0B6E4F"],
    price: 110,
    aspect: 1.5,
    silhouette: "wide-leg",
    length: "ankle",
    details: ["crease"],
    sizeChartId: "womens-bottoms",
  },
  {
    id: "w-07",
    name: "Peach ribbed tank",
    brand: "Sunday Club",
    category: "top",
    cut: "womens",
    colors: ["#F9C8A0"],
    price: 28,
    aspect: 1.0,
    silhouette: "fitted",
    sleeve: "none",
    length: "hip",
    details: ["ribbing"],
    sizeChartId: "womens-tops",
  },
  {
    id: "w-08",
    name: "Dusty rose cardigan",
    brand: "Mire",
    category: "top",
    cut: "womens",
    colors: ["#C49A9A"],
    price: 68,
    aspect: 1.2,
    silhouette: "relaxed",
    sleeve: "long",
    length: "hip",
    details: ["placket"],
    sizeChartId: "womens-tops",
  },
  {
    id: "w-09",
    name: "Black tailored blazer",
    brand: "Noor",
    category: "outerwear",
    cut: "womens",
    colors: ["#0D0D0D"],
    price: 165,
    aspect: 1.4,
    silhouette: "tailored",
    sleeve: "long",
    length: "thigh",
    details: ["lapels"],
    sizeChartId: "womens-tops",
  },
  {
    id: "w-10",
    name: "Lavender pleated skirt",
    brand: "Calla",
    category: "bottom",
    cut: "womens",
    colors: ["#C9B6E4"],
    price: 74,
    aspect: 1.3,
    silhouette: "a-line",
    length: "knee",
    details: ["pleats"],
    sizeChartId: "womens-bottoms",
  },
  {
    id: "w-11",
    name: "Mustard floral sundress",
    brand: "Sunday Club",
    category: "dress",
    cut: "womens",
    colors: ["#D4A017", "#6B8E23"],
    price: 82,
    aspect: 1.6,
    silhouette: "a-line",
    sleeve: "none",
    length: "knee",
    sizeChartId: "womens-dresses",
  },
  {
    id: "w-12",
    name: "Ice white poplin shirt",
    brand: "Noor",
    category: "top",
    cut: "womens",
    colors: ["#FFFFFF"],
    price: 54,
    aspect: 1.1,
    silhouette: "boxy",
    sleeve: "long",
    length: "hip",
    details: ["placket"],
    sizeChartId: "womens-tops",
  },
  {
    id: "m-01",
    name: "Olive field jacket",
    brand: "Harlan",
    category: "outerwear",
    cut: "mens",
    colors: ["#6B8E23"],
    price: 148,
    aspect: 1.4,
    silhouette: "relaxed",
    sleeve: "long",
    length: "hip",
    details: ["placket"],
    sizeChartId: "mens-tops",
  },
  {
    id: "m-02",
    name: "Navy oxford shirt",
    brand: "Common Thread",
    category: "top",
    cut: "mens",
    colors: ["#1C2E6E"],
    price: 62,
    aspect: 1.2,
    silhouette: "fitted",
    sleeve: "long",
    length: "hip",
    details: ["placket"],
    sizeChartId: "mens-tops",
  },
  {
    id: "m-03",
    name: "Stone chino",
    brand: "Harlan",
    category: "bottom",
    cut: "mens",
    colors: ["#C4B29B"],
    price: 78,
    aspect: 1.5,
    silhouette: "slim",
    length: "ankle",
    sizeChartId: "mens-bottoms",
  },
  {
    id: "m-04",
    name: "Burgundy merino crew",
    brand: "Kettle",
    category: "top",
    cut: "mens",
    colors: ["#7A2E2E"],
    price: 89,
    aspect: 1.1,
    silhouette: "fitted",
    sleeve: "long",
    length: "hip",
    details: ["ribbing"],
    sizeChartId: "mens-tops",
  },
  {
    id: "m-05",
    name: "Slate grey overshirt",
    brand: "Common Thread",
    category: "outerwear",
    cut: "mens",
    colors: ["#6B7480"],
    price: 95,
    aspect: 1.3,
    silhouette: "boxy",
    sleeve: "long",
    length: "hip",
    details: ["placket"],
    sizeChartId: "mens-tops",
  },
  {
    id: "m-06",
    name: "Cobalt polo",
    brand: "Kettle",
    category: "top",
    cut: "mens",
    colors: ["#1F3FAF"],
    price: 48,
    aspect: 1.0,
    silhouette: "fitted",
    sleeve: "short",
    length: "hip",
    sizeChartId: "mens-tops",
  },
  {
    id: "m-07",
    name: "Coral linen shirt",
    brand: "Sunday Club",
    category: "top",
    cut: "mens",
    colors: ["#FF6F61"],
    price: 58,
    aspect: 1.2,
    silhouette: "relaxed",
    sleeve: "short",
    length: "hip",
    details: ["placket"],
    sizeChartId: "mens-tops",
  },
  {
    id: "m-08",
    name: "Espresso cord trouser",
    brand: "Harlan",
    category: "bottom",
    cut: "mens",
    colors: ["#4B3621"],
    price: 92,
    aspect: 1.6,
    silhouette: "straight",
    length: "ankle",
    details: ["crease"],
    sizeChartId: "mens-bottoms",
  },
  {
    id: "u-01",
    name: "Teal heavyweight hoodie",
    brand: "Fieldday",
    category: "top",
    cut: "unisex",
    colors: ["#008C95"],
    price: 70,
    aspect: 1.2,
    silhouette: "boxy",
    sleeve: "long",
    length: "hip",
    details: ["ribbing"],
    sizeChartId: "mens-tops",
  },
  {
    id: "u-02",
    name: "Cream cable sweater",
    brand: "Kettle",
    category: "top",
    cut: "unisex",
    colors: ["#EFE2CC"],
    price: 98,
    aspect: 1.3,
    silhouette: "relaxed",
    sleeve: "long",
    length: "hip",
    details: ["ribbing"],
    sizeChartId: "mens-tops",
  },
  {
    id: "u-03",
    name: "Washed denim jacket",
    brand: "Fieldday",
    category: "outerwear",
    cut: "unisex",
    colors: ["#6E8AA0"],
    price: 120,
    aspect: 1.4,
    silhouette: "cropped",
    sleeve: "long",
    length: "waist",
    details: ["placket"],
    sizeChartId: "mens-tops",
  },
  {
    id: "u-04",
    name: "Charcoal straight jean",
    brand: "Fieldday",
    category: "bottom",
    cut: "unisex",
    colors: ["#3A3D42"],
    price: 85,
    aspect: 1.5,
    silhouette: "straight",
    length: "ankle",
    sizeChartId: "mens-bottoms",
  },
];

export const CATEGORY_LABELS: Record<Category, string> = {
  top: "Tops",
  bottom: "Bottoms",
  dress: "Dresses",
  outerwear: "Outerwear",
};

export const SILHOUETTE_LABELS: Record<Silhouette, string> = {
  fitted: "Fitted",
  relaxed: "Relaxed",
  boxy: "Boxy",
  wrap: "Wrap",
  tailored: "Tailored",
  cropped: "Cropped",
  slip: "Slip",
  "a-line": "A-line",
  slim: "Slim",
  straight: "Straight",
  "wide-leg": "Wide-leg",
};

/**
 * Where Shop goes. Without a real product page yet, a shopping search for the
 * item is the closest honest stand-in.
 */
export function shopUrl(item: CatalogItem): string {
  return (
    item.productUrl ??
    `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(item.name)}`
  );
}

// Live listings seen this session, plus saved bookmarks restored at launch
// (store/saved), so the item sheet and saved lists can show them.
const LIVE = new Map<string, CatalogItem>();

export function rememberItems(items: CatalogItem[]) {
  for (const item of items) if (item.source) LIVE.set(item.id, item);
}

export function findItem(id: string): CatalogItem | undefined {
  return CATALOG.find((item) => item.id === id) ?? LIVE.get(id);
}
