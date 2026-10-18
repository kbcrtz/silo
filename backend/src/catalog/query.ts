import { rgbToLab } from "../analysis/color.ts";
import { hexToRgb, nameForHex } from "./colors.ts";

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
};
export type QueryStep = { query: string; category: Category };

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
const GARMENTS: Record<ShopFor, [string, Category][]> = {
  womens: [["blouse", "tops"], ["trousers", "bottoms"], ["knit sweater", "tops"], ["midi dress", "dresses"], ["jacket", "outerwear"], ["skirt", "bottoms"]],
  mens: [["shirt", "tops"], ["trousers", "bottoms"], ["knit sweater", "tops"], ["jacket", "outerwear"], ["t-shirt", "tops"], ["chinos", "bottoms"]],
  both: [["shirt", "tops"], ["trousers", "bottoms"], ["knit sweater", "tops"], ["jacket", "outerwear"], ["t-shirt", "tops"], ["dress", "dresses"]],
};

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
 * The searches behind one feed. A category or search text is one query; For
 * You is a short fixed list pairing palette color words with garments, which
 * the route walks two at a time. Same input, same plan.
 */
export function buildQueryPlan(params: DiscoverParams): QueryStep[] {
  const { category, q, shopFor } = params;
  const dept = DEPARTMENT[shopFor];
  if (category === "dresses" && shopFor === "mens") return [];
  if (category !== "for-you") return [{ query: join(dept, q, q && category === "all" ? undefined : TERMS[category]), category }];
  if (q) return [{ query: join(dept, q), category }];

  const names = [...new Set(orderedColors(params).map(nameForHex))];
  const word = STYLE_WORD[params.style][names.length ? "withPalette" : "alone"];
  const garments = GARMENTS[shopFor];
  const size = names.length ? PLAN_SIZE : garments.length;
  const plan = Array.from({ length: size }, (_, i) => {
    const [garment, garmentCategory] = garments[i % garments.length];
    return { query: join(dept, names[i % names.length], word, garment), category: garmentCategory };
  });
  // Few distinct colors repeat (color, garment) pairs; repeated searches return the same products.
  return plan.filter((step, i) => plan.findIndex((s) => s.query === step.query) === i);
}
