import type { Aesthetic } from "@/data/aesthetics";

/**
 * Words in a listing title that say which look it belongs to. The backend
 * tags items its look searches returned (`aesthetic` on the product); these
 * cover everything else, so taste can still score plain searches, saved
 * bookmarks and demo items. Rough on purpose: a miss scores nothing.
 */
const LOOK_WORDS: [Aesthetic, RegExp][] = [
  ["streetwear", /\b(cargos?|hoodie|graphic|baggy|parachute|varsity|oversized tee)\b/],
  ["preppy", /\b(cable[- ]knit|argyle|rugby|oxford|sweater vest|pleated mini|polo sweater|button[- ]down)\b/],
  ["boho", /\b(boho|crochet|tiered|peasant|embroider(ed|y)|paisley|flared jeans)\b/],
  ["romantic", /\b(lace|ruffled?|floral|puff sleeve|satin|bow)\b/],
  ["edgy", /\b(faux leather|leather|vegan leather|shacket|studded)\b/],
  ["sporty", /\b(track (jacket|top|pants?)|windbreaker|joggers?|quarter[- ]zip|tennis|athletic|performance)\b/],
  ["classic", /\b(trench|blazer|tailored|merino|overcoat|wool coat|shirt dress|pleated trousers?)\b/],
  ["minimal", /\b(mock neck|minimal(ist)?|essential|heavyweight tee|crew ?neck)\b/],
  ["workwear", /\b(chore|carpenter|canvas|workwear|rugged|flannel|duck)\b/],
  // Not "knit polo": cable-knit polo sweaters are preppy.
  ["retro", /\b(corduroy|bowling|camp collar|retro|70s)\b/],
];

/** Up to two looks a title points to, strongest-first by list order. */
export function looksFromTitle(title: string): Aesthetic[] {
  const t = title.toLowerCase();
  return LOOK_WORDS.filter(([, re]) => re.test(t))
    .map(([look]) => look)
    .slice(0, 2);
}

/**
 * Specific garments, finer than top/bottom/dress/outerwear: a hoodie and a
 * silk blouse are both "tops", but someone who saves hoodies wants hoodies.
 * Checked in order, so "sweater vest" wins over "sweater".
 */
const GARMENTS: [string, RegExp][] = [
  ["sweater vest", /\bsweater vest\b/],
  ["shirt dress", /\bshirt ?dress\b/],
  ["cargo pants", /\bcargos?\b/],
  ["jeans", /\bjeans?\b/],
  ["joggers", /\bjoggers?|sweatpants\b/],
  ["leggings", /\bleggings?\b/],
  ["chinos", /\bchinos?\b/],
  ["shorts", /\bshorts\b/],
  ["skirt", /\bskirts?\b/],
  ["trousers", /\b(trousers?|pants?|slacks)\b/],
  ["dress", /\b(dress|gown)\b/],
  ["jumpsuit", /\b(jumpsuit|romper|overalls?)\b/],
  ["blazer", /\bblazer\b/],
  ["trench", /\btrench\b/],
  ["puffer", /\b(puffer|down jacket|quilted)\b/],
  ["bomber", /\bbomber\b/],
  ["coat", /\b(coat|overcoat|parka)\b/],
  ["cardigan", /\bcardigan\b/],
  ["overshirt", /\b(overshirt|shacket)\b/],
  ["jacket", /\b(jacket|windbreaker|anorak)\b/],
  ["hoodie", /\b(hoodie|hoody)\b/],
  ["sweatshirt", /\b(sweatshirt|crewneck sweat|quarter[- ]zip)\b/],
  ["sweater", /\b(sweater|jumper|pullover|knit)\b/],
  ["polo", /\bpolo\b/],
  ["blouse", /\bblouse\b/],
  ["tee", /\b(t-?shirt|tee)\b/],
  ["tank", /\b(tank|cami|camisole)\b/],
  ["shirt", /\b(shirt|button-?up|button-?down)\b/],
  ["top", /\b(top|bodysuit)\b/],
];

/** The specific garment a title names, or undefined. */
export function garmentFromTitle(title: string): string | undefined {
  const t = title.toLowerCase();
  return GARMENTS.find(([, re]) => re.test(t))?.[0];
}

/**
 * An item's look tags and garment for taste: the backend's tag from the
 * search that found it, else the title's words. Works on live items, saved
 * bookmarks and demo items alike.
 */
export function tagsOf(item: {
  id: string;
  name: string;
  aesthetics?: Aesthetic[];
  garment?: string;
}): { id: string; aesthetics: Aesthetic[]; garment?: string } {
  return {
    id: item.id,
    aesthetics: item.aesthetics?.length ? item.aesthetics : looksFromTitle(item.name),
    garment: item.garment ?? garmentFromTitle(item.name),
  };
}
