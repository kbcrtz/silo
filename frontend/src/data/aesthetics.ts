import type { ShopFor } from "@/store/profile";

/**
 * Style looks the shopper can pick. The backend turns each into searches of
 * garment phrases (backend/src/catalog/aesthetics.ts); keep the ids and
 * which department has which look in step with its RECIPES. Named
 * "aesthetic" in code because `looks.ts` is the paywall's photo set.
 */
export const AESTHETICS = [
  "minimal",
  "classic",
  "casual",
  "streetwear",
  "sporty",
  "preppy",
  "boho",
  "romantic",
  "edgy",
  "workwear",
  "retro",
] as const;
export type Aesthetic = (typeof AESTHETICS)[number];

/**
 * A look this app version knows. The server can add looks before the app
 * does, so ids from the server or an older backup pass through this first.
 */
export const isAesthetic = (a: unknown): a is Aesthetic =>
  AESTHETICS.includes(a as Aesthetic);

type Dept = "womens" | "mens";

export type AestheticInfo = {
  label: string;
  /** Three example pieces per department, as the picker shows them. */
  examples: Partial<Record<Dept, string>>;
  /** Casual has no searches of its own: liking it means the plain feed. */
  searchable: boolean;
};

export const AESTHETIC_INFO: Record<Aesthetic, AestheticInfo> = {
  minimal: {
    label: "Minimal",
    examples: {
      womens: "Mock necks · fine knits · straight trousers",
      mens: "Mock necks · heavyweight tees · relaxed trousers",
    },
    searchable: true,
  },
  classic: {
    label: "Classic",
    examples: {
      womens: "Trench coats · blazers · pleated trousers",
      mens: "Merino · tailored trousers · overcoats",
    },
    searchable: true,
  },
  casual: {
    label: "Casual",
    examples: {
      womens: "Tees · jeans · easy layers",
      mens: "Tees · jeans · easy layers",
    },
    searchable: false,
  },
  streetwear: {
    label: "Streetwear",
    examples: {
      womens: "Oversized hoodies · cargos · baggy jeans",
      mens: "Graphic tees · cargos · varsity jackets",
    },
    searchable: true,
  },
  sporty: {
    label: "Sporty",
    examples: {
      womens: "Quarter-zips · track jackets · tennis skirts",
      mens: "Track jackets · performance polos · joggers",
    },
    searchable: true,
  },
  preppy: {
    label: "Preppy",
    examples: {
      womens: "Cable knits · argyle · pleated minis",
      mens: "Rugby shirts · oxfords · chinos",
    },
    searchable: true,
  },
  boho: {
    label: "Boho",
    examples: { womens: "Tiered skirts · crochet · embroidery" },
    searchable: true,
  },
  romantic: {
    label: "Romantic",
    examples: { womens: "Lace · ruffles · florals" },
    searchable: true,
  },
  edgy: {
    label: "Edgy",
    examples: { womens: "Faux leather · shackets · minis" },
    searchable: true,
  },
  workwear: {
    label: "Workwear",
    examples: { mens: "Chore jackets · carpenter pants · canvas" },
    searchable: true,
  },
  retro: {
    label: "Retro",
    examples: { mens: "Camp collars · corduroy · knit polos" },
    searchable: true,
  },
};

/** The looks a department offers, in picker order. "Both" offers every look. */
export function aestheticsFor(shopFor: ShopFor): Aesthetic[] {
  return AESTHETICS.filter(
    (a) => shopFor === "both" || AESTHETIC_INFO[a].examples[shopFor],
  );
}

/** The picker's example line, from the department's own pieces where it has them. */
export function examplesFor(look: Aesthetic, shopFor: ShopFor): string {
  const { examples } = AESTHETIC_INFO[look];
  return (
    (shopFor !== "both" && examples[shopFor]) ||
    examples.womens ||
    examples.mens ||
    ""
  );
}
