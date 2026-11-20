/**
 * Style looks the shopper picks in the app (frontend/src/data/aesthetics.ts),
 * and the searches behind each. Shopify search is keyword search, so a look
 * is a recipe of concrete garment phrases ("cable knit polo sweater"), never
 * its own name: in live checks, look names collapsed to 2–4 on-look results
 * in 10 once the palette Color filter was on, while garment phrases held at
 * 7 or more. Every phrase here was checked live under a palette color
 * (2026-11-19); "oxford shirt" and "peasant blouse" failed it for women
 * (uniform shirts, generic blouses).
 */
export const AESTHETICS = ["minimal", "classic", "casual", "streetwear", "sporty", "preppy", "boho", "romantic", "edgy", "workwear", "retro"] as const;
export type Aesthetic = (typeof AESTHETICS)[number];

/** The feed category a phrase's results belong to. Jeans phrases count as bottoms. */
export type RecipeCategory = "tops" | "bottoms" | "dresses" | "outerwear";
export type Recipe = [phrase: string, category: RecipeCategory][];

/** Casual has no recipe: liking it means the plain plan. A look missing from a department has no searches there. */
export const RECIPES: Record<"womens" | "mens", Partial<Record<Aesthetic, Recipe>>> = {
  womens: {
    minimal: [["mock neck top", "tops"], ["fine knit crew neck sweater", "tops"], ["straight leg trousers", "bottoms"], ["crew neck tee", "tops"], ["wide leg tailored trousers", "bottoms"]],
    classic: [["trench coat", "outerwear"], ["tailored blazer", "outerwear"], ["button-up shirt", "tops"], ["pleated trousers", "bottoms"], ["shirt dress", "dresses"]],
    streetwear: [["oversized hoodie", "tops"], ["cargo pants", "bottoms"], ["oversized graphic tee", "tops"], ["baggy jeans", "bottoms"], ["bomber jacket", "outerwear"]],
    sporty: [["quarter zip pullover", "tops"], ["track jacket", "outerwear"], ["joggers", "bottoms"], ["tennis skirt", "bottoms"], ["windbreaker", "outerwear"]],
    preppy: [["cable knit polo sweater", "tops"], ["cable knit sweater", "tops"], ["pleated mini skirt", "bottoms"], ["argyle sweater", "tops"], ["sweater vest", "tops"]],
    boho: [["boho dress", "dresses"], ["tiered maxi skirt", "bottoms"], ["crochet top", "tops"], ["embroidered blouse", "tops"], ["flared jeans", "bottoms"]],
    romantic: [["puff sleeve blouse", "tops"], ["lace top", "tops"], ["floral midi dress", "dresses"], ["satin midi skirt", "bottoms"], ["ruffle blouse", "tops"]],
    edgy: [["faux leather jacket", "outerwear"], ["faux leather pants", "bottoms"], ["faux leather mini skirt", "bottoms"], ["faux leather blazer", "outerwear"], ["faux leather shacket", "outerwear"]],
  },
  mens: {
    minimal: [["mock neck t-shirt", "tops"], ["heavyweight tee", "tops"], ["relaxed trousers", "bottoms"], ["mock neck sweater", "tops"], ["crew neck sweater", "tops"]],
    classic: [["merino sweater", "tops"], ["tailored trousers", "bottoms"], ["dress shirt", "tops"], ["wool overcoat", "outerwear"], ["blazer", "outerwear"]],
    streetwear: [["cargo pants", "bottoms"], ["boxy graphic t-shirt", "tops"], ["oversized hoodie", "tops"], ["baggy jeans", "bottoms"], ["varsity jacket", "outerwear"]],
    sporty: [["track jacket", "outerwear"], ["quarter-zip pullover", "tops"], ["performance polo", "tops"], ["joggers", "bottoms"], ["windbreaker", "outerwear"]],
    preppy: [["rugby shirt", "tops"], ["cable knit sweater", "tops"], ["oxford button-down shirt", "tops"], ["chinos", "bottoms"], ["quarter-zip sweater", "tops"]],
    workwear: [["workwear jacket", "outerwear"], ["chore jacket", "outerwear"], ["rugged shirt", "tops"], ["carpenter pants", "bottoms"], ["canvas work pants", "bottoms"]],
    retro: [["knit polo", "tops"], ["corduroy jacket", "outerwear"], ["camp collar shirt", "tops"], ["bowling shirt", "tops"], ["corduroy trousers", "bottoms"]],
  },
};

/**
 * Never in a query: they pull goth and punk stores, motorcycle gear, or
 * second-hand listings. Look names are left out too, except where merchants
 * use the word itself: "boho dress" and "workwear jacket" held at 9 in 10
 * under a color filter.
 */
export const BANNED_WORDS = ["edgy", "moto", "biker", "punk", "goth", "vintage", "minimalist", "streetwear", "preppy", "romantic", "sporty", "retro"];

/** A look's phrases for one department, minus any containing a word the body avoids. */
export function phrasesFor(look: Aesthetic, dept: "womens" | "mens", avoid: ReadonlySet<string> = new Set()): Recipe {
  return (RECIPES[dept][look] ?? []).filter(([phrase]) => !phrase.split(/[\s-]+/).some((w) => avoid.has(w)));
}

/** Looks with searches in this department ("both" has the union). */
export function hasRecipe(look: Aesthetic, shopFor: "womens" | "mens" | "both"): boolean {
  return shopFor === "both" ? Boolean(RECIPES.womens[look] ?? RECIPES.mens[look]) : Boolean(RECIPES[shopFor][look]);
}
