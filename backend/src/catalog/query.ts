import { rgbToLab } from "../analysis/color.ts";
import { familyFor, hexToRgb, nameForHex, type Family } from "./colors.ts";

export const CATEGORIES = ["for-you", "all", "tops", "bottoms", "jeans", "shorts", "sweats", "dresses", "outerwear"] as const;
export type Category = (typeof CATEGORIES)[number];
export const STYLES = ["minimal", "colorful", "dark", "none"] as const;
export type Style = (typeof STYLES)[number];
export type ShopFor = "womens" | "mens" | "both";

export type DiscoverParams = {
  category: Category;
  q?: string;
  shopFor: ShopFor;
  style: Style;
  /** The season's best colors and neutrals, as the app sends them (hex). */
  palette: string[];
  neutrals: string[];
  /** Varies the feed (which searches, their order and style words) so every open and refresh differs. Absent: the fixed plan. */
  seed?: number;
};
/** `color` is the Shopify color family a For You search filters on. */
export type QueryStep = { query: string; category: Category; color?: Family };

// Shopify search is natural language and products carry no reliable category,
// so a category is a phrase in the query, plus the clothing taxonomy filter.
const TERMS: Record<Exclude<Category, "for-you">, string> = {
  all: "clothing",
  tops: "tops",
  bottoms: "pants",
  jeans: "jeans",
  shorts: "shorts",
  sweats: "sweatshirts and sweatpants",
  dresses: "dresses",
  outerwear: "jackets and coats",
};

const DEPARTMENT: Record<ShopFor, string> = { womens: "women's", mens: "men's", both: "" };

/** For You garments, alternating categories so a page isn't one kind of item. */
const GARMENTS: Record<ShopFor, [string, Exclude<Category, "for-you">][]> = {
  womens: [["blouse", "tops"], ["trousers", "bottoms"], ["knit sweater", "tops"], ["midi dress", "dresses"], ["jacket", "outerwear"], ["skirt", "bottoms"]],
  mens: [["shirt", "tops"], ["trousers", "bottoms"], ["knit sweater", "tops"], ["jacket", "outerwear"], ["t-shirt", "tops"], ["chinos", "bottoms"]],
  both: [["shirt", "tops"], ["trousers", "bottoms"], ["knit sweater", "tops"], ["jacket", "outerwear"], ["t-shirt", "tops"], ["dress", "dresses"]],
};

/**
 * Style words that send the same category search to different products and
 * stores. "" keeps the plain search in the mix. Shopify ranks the same query
 * the same way every time and has no "newest" sort, so varying the words is
 * what varies the feed.
 */
const VARIETY: Record<Exclude<Category, "for-you">, string[]> = {
  all: ["", "linen", "cotton", "relaxed", "vintage", "everyday", "oversized", "knit", "tailored", "lightweight"],
  tops: ["", "linen", "cotton", "ribbed", "oversized", "cropped", "silk", "relaxed", "fitted", "knit"],
  bottoms: ["", "wide-leg", "straight", "pleated", "linen", "tailored", "relaxed", "cargo", "high-rise"],
  jeans: ["", "straight", "wide-leg", "high-rise", "relaxed", "bootcut", "slim", "vintage"],
  shorts: ["", "linen", "denim", "high-rise", "relaxed", "tailored", "cotton"],
  sweats: ["", "fleece", "oversized", "cotton", "relaxed", "zip-up", "cropped"],
  dresses: ["", "wrap", "linen", "knit", "slip", "satin", "shirt", "cotton"],
  outerwear: ["", "wool", "cropped", "oversized", "quilted", "denim", "lightweight", "tailored"],
};
const CATEGORY_STEPS = 4;

/** A small seeded random generator (mulberry32): the same seed gives the same sequence. */
export function seededRandom(seed: number): () => number {
  // Scramble first: mulberry32's first output barely moves between neighboring seeds (seed, seed + page).
  let a = Math.imul(seed ^ (seed >>> 16), 0x85ebca6b);
  a = Math.imul(a ^ (a >>> 13), 0xc2b2ae35);
  a = (a ^ (a >>> 16)) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(items: T[], random: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** With palette colors the style picks which colors lead; without them it is the only signal. */
const STYLE_WORD: Record<Style, { withPalette: string; alone: string }> = {
  minimal: { withPalette: "minimalist", alone: "minimalist neutral" },
  colorful: { withPalette: "", alone: "colorful" },
  dark: { withPalette: "", alone: "dark" },
  none: { withPalette: "", alone: "" },
};

const PLAN_SIZE = 8;

const lab = (hex: string) => rgbToLab(hexToRgb(hex));
const chroma = (hex: string) => Math.hypot(lab(hex).a, lab(hex).b);

/** Palette colors in the order the style wants them: neutrals for minimal, saturated for colorful, darkest for dark. */
function orderedColors({ style, palette, neutrals }: DiscoverParams): string[] {
  if (style === "minimal") return [...neutrals, ...[...palette].sort((a, b) => chroma(a) - chroma(b))];
  if (style === "colorful") return [...palette].sort((a, b) => chroma(b) - chroma(a));
  if (style === "dark") return [...palette, ...neutrals].sort((a, b) => lab(a).l - lab(b).l);
  return palette.flatMap((c, i) => [c, neutrals[i]]).concat(neutrals.slice(palette.length)).filter(Boolean);
}

const join = (...parts: (string | undefined)[]) => parts.filter(Boolean).join(" ").replace(/\s+/g, " ").trim();

/**
 * The searches behind one feed. Search text is one query. A category is one
 * query, or with a seed several of that category with different style words.
 * For You pairs palette color words with garments; a seed shuffles the
 * garments and colors and adds style words. The route walks multi-step plans
 * two at a time. Same input and seed, same plan.
 */
export function buildQueryPlan(params: DiscoverParams): QueryStep[] {
  const { category, q, shopFor } = params;
  const dept = DEPARTMENT[shopFor];
  if (category === "dresses" && shopFor === "mens") return [];
  const random = params.seed === undefined ? null : seededRandom(params.seed);
  if (category !== "for-you" && (q || !random)) return [{ query: join(dept, q, q && category === "all" ? undefined : TERMS[category]), category }];
  if (category !== "for-you") {
    return shuffle(VARIETY[category], random!)
      .slice(0, CATEGORY_STEPS)
      .map((variety) => ({ query: join(dept, variety, TERMS[category]), category }));
  }
  if (q) return [{ query: join(dept, q), category }];

  const ordered = [...new Set(orderedColors(params).map(nameForHex))];
  // A seed keeps the style's color order but starts at a random one, and shuffles the garments.
  const start = random && ordered.length ? Math.floor(random() * ordered.length) : 0;
  const names = [...ordered.slice(start), ...ordered.slice(0, start)];
  const word = STYLE_WORD[params.style][names.length ? "withPalette" : "alone"];
  const garments = random ? shuffle(GARMENTS[shopFor], random) : GARMENTS[shopFor];
  const size = names.length ? PLAN_SIZE : garments.length;
  const plan = Array.from({ length: size }, (_, i) => {
    const [garment, garmentCategory] = garments[i % garments.length];
    const name = names[i % names.length];
    const words = VARIETY[garmentCategory];
    const variety = random ? words[Math.floor(random() * words.length)] : undefined;
    return { query: join(dept, name, word, variety, garment), category: garmentCategory, ...(name && { color: familyFor(name) }) };
  });
  // Few distinct colors repeat (color, garment) pairs; repeated searches return the same products.
  return plan.filter((step, i) => plan.findIndex((s) => s.query === step.query) === i);
}
