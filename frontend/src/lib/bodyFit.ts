import type { CatalogItem } from "@/data/catalog";
import type { ShopFor } from "@/store/profile";
import { bodyShape, type BodyShape } from "./bodyShape";
import type { Measurements } from "./measurements";
import { silhouetteMatch } from "./silhouette";

/**
 * What the measurements say about a frame beyond its shape. Each is left
 * out when it's average or can't be told, so only what stands out steers
 * the feed.
 */
export type BodyTraits = {
  shape?: BodyShape;
  height?: "petite" | "tall";
  /** From waist to height, or else weight to height. */
  build?: "slender" | "fuller";
  /** Inseam against height. */
  legs?: "short" | "long";
};

/** Petite under the first, tall from the second (cm). Menswear runs taller. */
const HEIGHT: Record<ShopFor, [petite: number, tall: number]> = {
  womens: [160, 175],
  mens: [170, 188],
  both: [165, 182],
};
/** Waist over height: under this reads slender, from the next fuller. */
const WAIST_RATIO: [slender: number, fuller: number] = [0.42, 0.55];
/** BMI, when there's weight but no waist. */
const BMI: [slender: number, fuller: number] = [19, 29];
/** Inseam over height: legs run about 45% of height. */
const LEG_RATIO: [short: number, long: number] = [0.44, 0.48];

export function bodyTraits(m: Measurements, shopFor: ShopFor): BodyTraits {
  const traits: BodyTraits = {};
  const shape = bodyShape(m)?.shape;
  if (shape) traits.shape = shape;
  const { height, waist, weight, inseam } = m;
  if (!height) return traits;

  const [petite, tall] = HEIGHT[shopFor];
  if (height < petite) traits.height = "petite";
  else if (height >= tall) traits.height = "tall";

  const [lean, full] = waist ? WAIST_RATIO : BMI;
  const ratio = waist
    ? waist / height
    : weight
      ? weight / (height / 100) ** 2
      : undefined;
  if (ratio !== undefined && ratio < lean) traits.build = "slender";
  else if (ratio !== undefined && ratio >= full) traits.build = "fuller";

  if (inseam) {
    const legs = inseam / height;
    if (legs < LEG_RATIO[0]) traits.legs = "short";
    else if (legs > LEG_RATIO[1]) traits.legs = "long";
  }
  return traits;
}

export const hasTraits = (traits: BodyTraits) => Object.keys(traits).length > 0;

export type BodyFit = {
  /** 0-100. */
  score: number;
  label: "Flatters you" | "Works for you" | "Less flattering";
  /** The rule that weighed most, in the direction of the label. */
  reason?: string;
};

type Piece = Pick<CatalogItem, "category" | "silhouette" | "length">;
type Rule = { delta: number; reason: string };

const isTop = (p: Piece) => p.category === "top" || p.category === "outerwear";
/** A top that ends at the waist, whatever its cut is called. */
const cropped = (p: Piece) =>
  isTop(p) && (p.length === "waist" || p.silhouette === "cropped");
const clingy = (p: Piece) =>
  p.silhouette === "fitted" ||
  p.silhouette === "slim" ||
  p.silhouette === "slip";
const voluminous = (p: Piece) =>
  p.silhouette === "boxy" || p.silhouette === "relaxed";
const fullLength = (p: Piece) =>
  p.category === "bottom" &&
  p.length === "ankle" &&
  (p.silhouette === "straight" ||
    p.silhouette === "wide-leg" ||
    p.silhouette === "tailored");

/**
 * The stylist's rules for proportion and build. Petite: show leg and keep
 * lines long, so short tops, knee hems and full-length trousers, and nothing
 * that swamps. Tall: carries volume and length. Fuller: skim rather than
 * cling, and keep hems off the middle. Slender: volume adds shape. Short
 * legs: raise the waistline; long legs: balance them with longer tops.
 */
function rules(p: Piece, t: BodyTraits): Rule[] {
  const out: Rule[] = [];
  const add = (when: boolean, delta: number, reason: string) =>
    when && out.push({ delta, reason });
  // A fuller build overrides "show the waist": a cropped top lands on the middle.
  const showWaist = t.build !== "fuller";

  if (t.height === "petite") {
    add(showWaist && cropped(p), 0.15, "A cropped length shows more leg");
    add(isTop(p) && p.length === "thigh", -0.15, "Long tops shorten the leg");
    add(
      p.category === "outerwear" &&
        (p.length === "knee" || p.length === "midi" || p.length === "ankle"),
      -0.15,
      "A long coat can swamp a petite frame",
    );
    add(
      p.silhouette === "boxy",
      -0.15,
      "Oversized cuts can swamp a petite frame",
    );
    add(fullLength(p), 0.1, "A full-length leg adds height");
    add(
      p.category === "bottom" && p.length === "midi",
      -0.15,
      "Cropped hems cut the leg line",
    );
    add(
      p.category === "dress" && p.length === "knee",
      0.1,
      "A knee-length hem keeps your legs long",
    );
    add(
      p.category === "dress" && p.length === "midi",
      -0.15,
      "A midi hem can shorten a petite frame",
    );
  }
  if (t.height === "tall") {
    add(voluminous(p), 0.1, "Your height carries volume");
    add(
      (p.category === "dress" || p.category === "outerwear") &&
        (p.length === "midi" || p.length === "ankle"),
      0.1,
      "Your height carries longer lengths",
    );
  }
  if (t.build === "fuller") {
    add(cropped(p), -0.3, "A cropped hem lands on the midsection");
    add(clingy(p), -0.2, "A cut that skims is easier than one that clings");
    add(p.silhouette === "boxy", -0.1, "Boxy cuts add bulk without shape");
    add(
      p.silhouette === "wrap",
      0.15,
      "A wrap defines the waist without clinging",
    );
    add(
      p.silhouette === "straight" ||
        p.silhouette === "tailored" ||
        p.silhouette === "a-line",
      0.1,
      "Structure that skims rather than clings",
    );
  }
  if (t.build === "slender") {
    add(voluminous(p), 0.1, "Volume adds shape to a slim frame");
  }
  if (t.legs === "short") {
    add(showWaist && cropped(p), 0.1, "A shorter top lengthens the leg");
    add(isTop(p) && p.length === "thigh", -0.1, "Long tops shorten the leg");
    add(fullLength(p), 0.05, "A full-length leg adds height");
  }
  if (t.legs === "long") {
    add(
      isTop(p) && (p.length === "hip" || p.length === "thigh"),
      0.05,
      "A longer top balances long legs",
    );
  }
  return out;
}

/** With no shape to go by, a cut starts here and the other rules move it. */
const NEUTRAL = 0.7;

/**
 * How well a piece suits this body: its cut for the shape, then each rule
 * for height, build and leg length nudges it. The reason is the strongest
 * rule pulling the same way as the label (or the shape, when none do).
 */
export function bodyFit(
  piece: Piece,
  traits: BodyTraits,
  /** Rules the shopper has overruled by saving what they sink (lib/tasteLearn). */
  waived: ReadonlySet<string> = new Set(),
): BodyFit {
  const base = traits.shape
    ? silhouetteMatch(piece.silhouette, traits.shape).score / 100
    : NEUTRAL;
  const applied = rules(piece, traits).filter((r) => !waived.has(r.reason));
  const fit = Math.min(
    1,
    Math.max(0, base + applied.reduce((sum, r) => sum + r.delta, 0)),
  );
  const label =
    fit >= 0.8
      ? "Flatters you"
      : fit >= 0.6
        ? "Works for you"
        : "Less flattering";
  const good = label !== "Less flattering";
  const strongest = applied
    .filter((r) => (good ? r.delta > 0 : r.delta < 0))
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))[0];
  return {
    score: Math.round(fit * 100),
    label,
    reason: strongest?.reason,
  };
}

/**
 * The body rules pulling this piece down, by their reason, which is also
 * the rule's id ("Long tops shorten the leg" is one rule wherever it
 * applies). Saving three pieces a rule sinks waives it.
 */
export function sinkingRules(piece: Piece, traits: BodyTraits): string[] {
  return [
    ...new Set(rules(piece, traits).filter((r) => r.delta < 0).map((r) => r.reason)),
  ];
}

/**
 * The body the feed is cut for, as the subtitle says it: "petite, fuller
 * apple shape", "tall frame", "hourglass shape". Null with nothing to say.
 */
export function describeBody(t: BodyTraits): string | null {
  const words = [t.height, t.build].filter(Boolean).join(", ");
  const noun = t.shape ? `${SHAPE_NAMES[t.shape]} shape` : "frame";
  if (!words && !t.shape) return null;
  return words ? `${words} ${noun}` : noun;
}

const SHAPE_NAMES: Record<BodyShape, string> = {
  hourglass: "hourglass",
  pear: "pear",
  "inverted-triangle": "inverted triangle",
  apple: "apple",
  rectangle: "rectangle",
};
