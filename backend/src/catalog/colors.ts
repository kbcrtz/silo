import { deltaE76, type RGB } from "../analysis/color.ts";

/**
 * Approximate swatches for color words shoppers and merchants use. Shopify
 * gives color names, never hex, so these are only good for broad ranking and
 * for turning a palette into search words; they are not the garment's color.
 * "denim" is left out on purpose: it names a fabric more often than a color.
 */
const COLORS: Record<string, string> = {
  black: "#000000",
  white: "#FFFFFF",
  "off white": "#F5F2EA",
  ivory: "#FFFFF0",
  cream: "#F3E9D2",
  ecru: "#E8DCC4",
  oatmeal: "#DCCFB9",
  beige: "#D9C4A3",
  sand: "#C9B28F",
  stone: "#B8AE9C",
  khaki: "#B9A77B",
  tan: "#D2B48C",
  camel: "#C19A6B",
  taupe: "#8B7D6B",
  brown: "#6F4E37",
  "dark brown": "#4B3621",
  chocolate: "#4E2E1E",
  rust: "#A0472A",
  terracotta: "#C4673F",
  "burnt orange": "#CC5500",
  orange: "#F28C28",
  peach: "#F6B993",
  coral: "#F47C6B",
  salmon: "#F08C7A",
  red: "#C8102E",
  burgundy: "#7A1F2B",
  maroon: "#6B1E26",
  wine: "#6E2232",
  pink: "#F4A6B8",
  "dusty pink": "#D8A7A7",
  blush: "#E8B8B0",
  rose: "#D9828F",
  "hot pink": "#E9418A",
  fuchsia: "#D1307F",
  magenta: "#C2185B",
  mauve: "#B48A96",
  lilac: "#C8A2C8",
  lavender: "#B9A7D6",
  purple: "#6A3D9A",
  plum: "#6B3358",
  violet: "#7F4FC9",
  navy: "#1F2A44",
  blue: "#2F5DA8",
  cobalt: "#0047AB",
  "royal blue": "#4169E1",
  "light blue": "#A7C7E7",
  "sky blue": "#87CEEB",
  "baby blue": "#BCD4E6",
  indigo: "#3F3A75",
  teal: "#1F7A7A",
  turquoise: "#40C4C4",
  aqua: "#7FD8D8",
  mint: "#A8E6CF",
  sage: "#9CAF88",
  olive: "#556B2F",
  "olive green": "#6B7A3A",
  green: "#2E7D32",
  "forest green": "#234F1E",
  "dark green": "#1E4D2B",
  emerald: "#1F8A5B",
  lime: "#A4D65E",
  yellow: "#F6D743",
  mustard: "#C9A227",
  gold: "#C9A54C",
  silver: "#C0C0C0",
  gray: "#8E8E8E",
  "light gray": "#C8C8C8",
  "heather gray": "#A8A8A8",
  charcoal: "#36454F",
  "charcoal gray": "#3C4048",
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
  for (const [name, pattern] of PATTERNS) if (pattern.test(text)) return { name, hex: COLORS[name] };
  return null;
}

/** The nearest color word for a palette swatch, for building search queries. */
export function nameForHex(hex: string): string {
  const rgb = hexToRgb(hex);
  let best = BY_LENGTH[0];
  let bestDistance = Infinity;
  for (const name of BY_LENGTH) {
    const d = deltaE76(rgb, hexToRgb(COLORS[name]));
    if (d < bestDistance) [best, bestDistance] = [name, d];
  }
  return best;
}
