import type { FashionStyle } from "@/api/catalog";
import {
  AESTHETIC_INFO,
  AESTHETICS,
  aestheticsFor,
  type Aesthetic,
} from "@/data/aesthetics";
import type { ShopFor } from "@/store/profile";

/** How many looks a shopper can pick, and how many the backend takes. */
export const MAX_LOOKS = 3;
/** The backend takes up to this many avoided looks. */
const MAX_AVOID = 4;

/** What the shopper told us: looks they like and turned down, and how they wear color. */
export type StatedTaste = {
  /** Most liked first. */
  liked: Aesthetic[];
  rejected: Aesthetic[];
  colorStyle: FashionStyle;
  via: "onboarding" | "profile";
  /** ISO time it was last set. */
  at: string;
};

export const COLOR_STYLES: { id: FashionStyle; label: string }[] = [
  { id: "minimal", label: "Neutrals" },
  { id: "none", label: "A mix" },
  { id: "colorful", label: "Bold" },
  // "Deeper shades", not "dark": black is on light seasons' avoid list.
  { id: "dark", label: "Deeper shades" },
];

const known = (a: unknown): a is Aesthetic =>
  AESTHETICS.includes(a as Aesthetic);

/**
 * The looks the feed asks the backend for. Only looks the department
 * offers and that have searches of their own (not casual), so none of the
 * three slots is wasted; unknown ids from an older backup are dropped.
 */
export function searchAesthetics(
  stated: StatedTaste | undefined,
  shopFor: ShopFor,
): { aesthetic: Aesthetic[]; avoid: Aesthetic[] } {
  if (!stated) return { aesthetic: [], avoid: [] };
  const offered = new Set(aestheticsFor(shopFor));
  const aesthetic = [...new Set(stated.liked)]
    .filter((a) => known(a) && offered.has(a) && AESTHETIC_INFO[a].searchable)
    .slice(0, MAX_LOOKS);
  const avoid = [...new Set(stated.rejected)]
    .filter((a) => known(a) && !aesthetic.includes(a))
    .slice(0, MAX_AVOID);
  return { aesthetic, avoid };
}

/** Tapping a look in the picker: on, off, or nothing when three are already on. */
export function toggleLook(liked: Aesthetic[], look: Aesthetic): Aesthetic[] {
  if (liked.includes(look)) return liked.filter((a) => a !== look);
  return liked.length >= MAX_LOOKS ? liked : [...liked, look];
}

/** The profile's line for the shopper's style: "Streetwear, Minimal · Neutrals". */
export function describeTaste(stated: StatedTaste | undefined): string | null {
  if (!stated) return null;
  const looks = stated.liked
    .filter(known)
    .map((a) => AESTHETIC_INFO[a].label)
    .join(", ");
  const color =
    stated.colorStyle === "none"
      ? null
      : COLOR_STYLES.find((c) => c.id === stated.colorStyle)?.label;
  return [looks, color].filter(Boolean).join(" · ") || null;
}
