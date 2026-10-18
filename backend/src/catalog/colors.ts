import { deltaE76, type RGB } from "../analysis/color.ts";

/** The color families Shopify's Color filter understands (checked live: it maps "Espresso" into Brown). */
export type Family = "Black" | "White" | "Gray" | "Beige" | "Brown" | "Red" | "Pink" | "Orange" | "Yellow" | "Green" | "Blue" | "Navy" | "Purple";

/**
 * Approximate swatches for color words shoppers and merchants use, with the
 * Shopify color family each belongs to. Shopify gives color names, never hex,
 * so these are only good for broad ranking and for turning a palette into
 * search words and filters; they are not the garment's color.
 * "denim" is left out on purpose: it names a fabric more often than a color.
 */
const COLORS: Record<string, [hex: string, family: Family]> = {
  black: ["#000000", "Black"],
  white: ["#FFFFFF", "White"],
  "off white": ["#F5F2EA", "White"],
  ivory: ["#FFFFF0", "White"],
  cream: ["#F3E9D2", "White"],
  ecru: ["#E8DCC4", "Beige"],
  oatmeal: ["#DCCFB9", "Beige"],
  beige: ["#D9C4A3", "Beige"],
  sand: ["#C9B28F", "Beige"],
  stone: ["#B8AE9C", "Beige"],
  khaki: ["#B9A77B", "Beige"],
  tan: ["#D2B48C", "Brown"],
  camel: ["#C19A6B", "Brown"],
  taupe: ["#8B7D6B", "Beige"],
  brown: ["#6F4E37", "Brown"],
  "dark brown": ["#4B3621", "Brown"],
  chocolate: ["#4E2E1E", "Brown"],
  rust: ["#A0472A", "Orange"],
  terracotta: ["#C4673F", "Orange"],
  "burnt orange": ["#CC5500", "Orange"],
  orange: ["#F28C28", "Orange"],
  peach: ["#F6B993", "Orange"],
  coral: ["#F47C6B", "Orange"],
  salmon: ["#F08C7A", "Pink"],
  red: ["#C8102E", "Red"],
  burgundy: ["#7A1F2B", "Red"],
  maroon: ["#6B1E26", "Red"],
  wine: ["#6E2232", "Red"],
  pink: ["#F4A6B8", "Pink"],
  "dusty pink": ["#D8A7A7", "Pink"],
  blush: ["#E8B8B0", "Pink"],
  rose: ["#D9828F", "Pink"],
  "hot pink": ["#E9418A", "Pink"],
  fuchsia: ["#D1307F", "Pink"],
  magenta: ["#C2185B", "Pink"],
  mauve: ["#B48A96", "Purple"],
  lilac: ["#C8A2C8", "Purple"],
  lavender: ["#B9A7D6", "Purple"],
  purple: ["#6A3D9A", "Purple"],
  plum: ["#6B3358", "Purple"],
  violet: ["#7F4FC9", "Purple"],
  navy: ["#1F2A44", "Navy"],
  blue: ["#2F5DA8", "Blue"],
  cobalt: ["#0047AB", "Blue"],
  "royal blue": ["#4169E1", "Blue"],
  "light blue": ["#A7C7E7", "Blue"],
  "sky blue": ["#87CEEB", "Blue"],
  "baby blue": ["#BCD4E6", "Blue"],
  indigo: ["#3F3A75", "Blue"],
  teal: ["#1F7A7A", "Blue"],
  turquoise: ["#40C4C4", "Blue"],
  aqua: ["#7FD8D8", "Blue"],
  mint: ["#A8E6CF", "Green"],
  sage: ["#9CAF88", "Green"],
  olive: ["#556B2F", "Green"],
  "olive green": ["#6B7A3A", "Green"],
  green: ["#2E7D32", "Green"],
  "forest green": ["#234F1E", "Green"],
  "dark green": ["#1E4D2B", "Green"],
  emerald: ["#1F8A5B", "Green"],
  lime: ["#A4D65E", "Green"],
  yellow: ["#F6D743", "Yellow"],
  mustard: ["#C9A227", "Yellow"],
  gold: ["#C9A54C", "Yellow"],
  silver: ["#C0C0C0", "Gray"],
  gray: ["#8E8E8E", "Gray"],
  "light gray": ["#C8C8C8", "Gray"],
  "heather gray": ["#A8A8A8", "Gray"],
  charcoal: ["#36454F", "Gray"],
  "charcoal gray": ["#3C4048", "Gray"],
};

// Longest first, so "olive green" wins over "olive" and "green".
const BY_LENGTH = Object.keys(COLORS).sort((a, b) => b.length - a.length);
const PATTERNS = BY_LENGTH.map((name) => [name, new RegExp(`\\b${name}\\b`)] as const);

export function hexToRgb(hex: string): RGB {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** The known color word in a merchant label or title, e.g. "Space Black" -> black. Null when none. */
export function colorFromName(label: string): { name: string; hex: string } | null {
  const text = label.toLowerCase().replace(/[-_/]/g, " ").replace(/\bgrey\b/g, "gray").replace(/\s+/g, " ");
  for (const [name, pattern] of PATTERNS) if (pattern.test(text)) return { name, hex: COLORS[name][0] };
  return null;
}

/** The nearest color word for a palette swatch, for building search queries. */
export function nameForHex(hex: string): string {
  const rgb = hexToRgb(hex);
  let best = BY_LENGTH[0];
  let bestDistance = Infinity;
  for (const name of BY_LENGTH) {
    const d = deltaE76(rgb, hexToRgb(COLORS[name][0]));
    if (d < bestDistance) [best, bestDistance] = [name, d];
  }
  return best;
}

/** The Shopify color family for one of this table's color words. */
export function familyFor(name: string): Family {
  return COLORS[name][1];
}
