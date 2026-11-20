import {
  AESTHETIC_INFO,
  AESTHETICS,
  aestheticsFor,
  isAesthetic,
  type Aesthetic,
} from "@/data/aesthetics";
import type { CatalogItem } from "@/data/catalog";
import type { ShopFor } from "@/store/profile";
import { MAX_LOOKS, type StatedTaste } from "./taste";

/**
 * What the shopper's actions say about their taste, beyond what they told
 * us. Scored per attribute (look and specific garment), never per product:
 * Shopify listings churn, and their terms forbid keeping catalog results.
 *
 * Every positive action adds points to an item's values; "Not for me" adds
 * negative points. Points halve every 30 days. A value's affinity is how far
 * its share of positive points sits above the shopper's own average in that
 * dimension, shrunk toward the average while there's little evidence, and
 * bounded to -1..1 so heavy users don't saturate.
 */

export type Counter = { p: number; n: number };
export type Learned = {
  /** When the counters were last decayed to. */
  asOf: string;
  aesthetic: Partial<Record<Aesthetic, Counter>>;
  garment: Record<string, Counter>;
};
/** The strongest credit each item has given, so open → save → shop is 5 points, not 9. */
export type Ledger = Record<string, number>;
/** `backfill`: an item saved before learning shipped, at half a save. */
export type Signal = "open" | "backfill" | "tryon" | "save" | "shop";

export const SIGNAL_POINTS: Record<Signal, number> = {
  open: 1,
  backfill: 1.5,
  tryon: 2,
  save: 3,
  shop: 5,
};
/** "Not for me": to each of the item's looks (split), and a little to its garment. */
const DISMISS_LOOK = 4;
const DISMISS_GARMENT = 1;
const HALF_LIFE_DAYS = 30;
/** Counters this small are dropped, so the backup stays small. */
const FLOOR = 0.05;
/** How many garments are kept; the backup is capped at 32 KB server side. */
const MAX_GARMENTS = 40;
export const MAX_LEDGER = 200;
/** Evidence needed before a value moves far from the average. */
const K = { aesthetic: 4, garment: 6 };
/** What a stated like or dislike is worth on its own. */
const STATED = 0.5;
/** Shares of an item's taste score. */
const WEIGHT = { aesthetic: 0.6, garment: 0.4 };

export const emptyLearned = (now: Date): Learned => ({
  asOf: now.toISOString(),
  aesthetic: {},
  garment: {},
});

/** The item's look tags and garment, as taste reads them. */
export type Tagged = Pick<CatalogItem, "id"> & {
  aesthetics?: Aesthetic[];
  garment?: string;
};

function decayed(map: Record<string, Counter>, factor: number, cap?: number) {
  const out = Object.entries(map)
    .map(([k, c]) => [k, { p: c.p * factor, n: c.n * factor }] as const)
    .filter(([, c]) => c.p >= FLOOR || c.n >= FLOOR)
    .sort(([, a], [, b]) => b.p + b.n - (a.p + a.n));
  return Object.fromEntries(cap ? out.slice(0, cap) : out);
}

/** Counters brought forward to `now`: halved every 30 days, tiny ones dropped. */
export function decay(learned: Learned, now: Date): Learned {
  const days = Math.max(
    0,
    (now.getTime() - new Date(learned.asOf).getTime()) / 86_400_000,
  );
  const factor = 0.5 ** (days / HALF_LIFE_DAYS);
  return {
    asOf: now.toISOString(),
    aesthetic: decayed(learned.aesthetic as Record<string, Counter>, factor),
    garment: decayed(learned.garment, factor, MAX_GARMENTS),
  };
}

function add(
  learned: Learned,
  item: Tagged,
  look: { p?: number; n?: number },
  garment: { p?: number; n?: number },
): Learned {
  const looks = item.aesthetics ?? [];
  const aesthetic = { ...learned.aesthetic };
  for (const a of looks) {
    const c = aesthetic[a] ?? { p: 0, n: 0 };
    // Two tags split the points.
    aesthetic[a] = {
      p: Math.max(0, c.p + (look.p ?? 0) / looks.length),
      n: Math.max(0, c.n + (look.n ?? 0) / looks.length),
    };
  }
  const garments = { ...learned.garment };
  if (item.garment) {
    const c = garments[item.garment] ?? { p: 0, n: 0 };
    garments[item.garment] = {
      p: Math.max(0, c.p + (garment.p ?? 0)),
      n: Math.max(0, c.n + (garment.n ?? 0)),
    };
  }
  return { ...learned, aesthetic, garment: garments };
}

/** Keeps the newest entries, as insertion order. */
function capLedger(ledger: Ledger): Ledger {
  const entries = Object.entries(ledger);
  return Object.fromEntries(entries.slice(-MAX_LEDGER));
}

/**
 * An action on an item. Only the strongest action per item counts: a save
 * after an open adds the difference, and a second open adds nothing.
 */
export function credit(
  learned: Learned,
  ledger: Ledger,
  item: Tagged,
  signal: Signal,
  now: Date,
): { learned: Learned; ledger: Ledger } {
  const points = SIGNAL_POINTS[signal];
  const before = ledger[item.id] ?? 0;
  if (points <= before) return { learned, ledger };
  const delta = points - before;
  const { [item.id]: _, ...rest } = ledger;
  return {
    learned: add(decay(learned, now), item, { p: delta }, { p: delta }),
    ledger: capLedger({ ...rest, [item.id]: points }),
  };
}

/** Unsaving takes back what the item gave: people prune lists, so it isn't a dislike. */
export function retract(
  learned: Learned,
  ledger: Ledger,
  item: Tagged,
  now: Date,
): { learned: Learned; ledger: Ledger } {
  const given = ledger[item.id];
  if (!given) return { learned, ledger };
  const { [item.id]: _, ...rest } = ledger;
  return {
    learned: add(decay(learned, now), item, { p: -given }, { p: -given }),
    ledger: rest,
  };
}

/** "Not for me": its looks and, a little, its garment count against. */
export function dismiss(learned: Learned, item: Tagged, now: Date): Learned {
  return add(
    decay(learned, now),
    item,
    { n: DISMISS_LOOK },
    { n: DISMISS_GARMENT },
  );
}

const logit = (q: number) => Math.log(q / (1 - q));
const clamp = (x: number) => Math.max(-1, Math.min(1, x));

/** Each value's learned affinity in one dimension, -1..1; an unseen value is 0. */
export function affinities(
  counters: Record<string, Counter>,
  k: number,
): Record<string, number> {
  const values = Object.values(counters);
  const P = values.reduce((s, c) => s + c.p, 0);
  const N = values.reduce((s, c) => s + c.n, 0);
  const m = (P + 1) / (P + N + 2);
  return Object.fromEntries(
    Object.entries(counters).map(([v, c]) => {
      const q = (c.p + k * m) / (c.p + c.n + k);
      return [v, clamp((logit(q) - logit(m)) / 2)];
    }),
  );
}

export type TasteModel = {
  /** Each look's affinity: stated plus learned, -1..1. */
  look: Record<Aesthetic, number>;
  garment: Record<string, number>;
  disliked: Set<Aesthetic>;
  /** Stated likes, in the order picked: breaks ties between equally liked looks. */
  liked: Aesthetic[];
  learned?: Learned;
};

/**
 * A look is disliked only on clear evidence: stated as rejected, or
 * dismissed at least once and more than twice as often as it earned points.
 * Relative scores never make a look disliked: a user who saves 100
 * streetwear pieces would otherwise push every other look below zero.
 */
export function tasteModel(
  stated: StatedTaste | undefined,
  learned: Learned | undefined,
): TasteModel {
  const learnedLook = learned
    ? affinities(learned.aesthetic as Record<string, Counter>, K.aesthetic)
    : {};
  const look = Object.fromEntries(
    AESTHETICS.map((a) => {
      const s = stated?.liked.includes(a)
        ? STATED
        : stated?.rejected.includes(a)
          ? -STATED
          : 0;
      return [a, clamp(s + (learnedLook[a] ?? 0))];
    }),
  ) as Record<Aesthetic, number>;
  const disliked = new Set(
    AESTHETICS.filter((a) => {
      if (stated?.liked.includes(a)) return false;
      const c = learned?.aesthetic[a];
      return (
        stated?.rejected.includes(a) ||
        (c !== undefined && c.n >= 4 && c.n >= 2 * c.p)
      );
    }),
  );
  return {
    look,
    garment: learned ? affinities(learned.garment, K.garment) : {},
    disliked,
    liked: stated?.liked ?? [],
    learned,
  };
}

const mean = (xs: number[]) =>
  xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;

/** How much the item suits the shopper's taste, -1..1. An item with no tags scores 0. */
export function tasteScore(item: Tagged, model: TasteModel): number {
  const looks = (item.aesthetics ?? []).map((a) => model.look[a] ?? 0);
  const garment = item.garment ? (model.garment[item.garment] ?? 0) : 0;
  return WEIGHT.aesthetic * mean(looks) + WEIGHT.garment * garment;
}

/** A look they've turned down, with no look on the item they like enough to keep it. */
export function softHidden(item: Tagged, model: TasteModel): boolean {
  const looks = item.aesthetics ?? [];
  return (
    looks.some((a) => model.disliked.has(a)) &&
    !looks.some((a) => (model.look[a] ?? 0) >= 0.3)
  );
}

/** How far taste can lift an item up a page, in places. Body fit sinks up to 10, so fit outweighs it. */
const LIFT = 8;
const FIT_SINK = 10;
const HIDDEN_SINK = 20;

/**
 * One page's order: each item keeps its place, sinks with a poor fit, rises
 * with taste, and a look they turned down goes to the end. Never a full
 * sort, which would bunch near-identical items.
 */
export function feedOrder<T>(
  items: T[],
  score: (item: T) => { fit: number; taste: number; hidden: boolean },
): T[] {
  return items
    .map((item, i) => {
      const s = score(item);
      return {
        item,
        at:
          i +
          FIT_SINK * (1 - s.fit / 100) -
          LIFT * s.taste +
          (s.hidden ? HIDDEN_SINK : 0),
      };
    })
    .sort((a, b) => a.at - b.at)
    .map((e) => e.item);
}

/**
 * The looks a new feed asks for: the two the shopper likes most (stated or
 * learned), plus one more drawn at random from the rest they haven't turned
 * down, weighted toward what they like. The rotating third keeps the feed
 * exploring. Avoid: looks they've turned down.
 */
export function pickLooks(
  model: TasteModel,
  shopFor: ShopFor,
  random: () => number,
): { aesthetic: Aesthetic[]; avoid: Aesthetic[] } {
  const offered = aestheticsFor(shopFor).filter(
    (a) => AESTHETIC_INFO[a].searchable && !model.disliked.has(a),
  );
  const order = (a: Aesthetic) => {
    const i = model.liked.indexOf(a);
    return i === -1 ? MAX_LOOKS : i;
  };
  const ranked = [...offered].sort(
    (a, b) => model.look[b] - model.look[a] || order(a) - order(b),
  );
  const top = ranked.filter((a) => model.look[a] >= 0.15).slice(0, 2);
  const rest = ranked.filter((a) => !top.includes(a));
  const aesthetic = [...top];
  if (top.length && rest.length && aesthetic.length < MAX_LOOKS) {
    const weights = rest.map((a) => Math.exp(2 * model.look[a]));
    let r = random() * weights.reduce((x, y) => x + y, 0);
    const i = weights.findIndex((w) => (r -= w) < 0);
    aesthetic.push(rest[i === -1 ? rest.length - 1 : i]);
  }
  const avoid = [...model.disliked].slice(0, 4);
  return { aesthetic, avoid };
}

/**
 * The item sheet's line on why it suits their taste, once there's real
 * evidence (3 points on the look). Worded so it never claims a specific
 * action: the points can come from saves, opens or Shop taps.
 */
export function tasteReason(item: Tagged, model: TasteModel): string | null {
  const best = (item.aesthetics ?? [])
    .filter((a) => isAesthetic(a) && (model.learned?.aesthetic[a]?.p ?? 0) >= 3)
    .sort((a, b) => model.look[b] - model.look[a])[0];
  if (!best || model.look[best] < 0.3) return null;
  return `In the ${AESTHETIC_INFO[best].label.toLowerCase()} look you keep coming back to`;
}

/** Saves or Shop taps on this many different pieces a body rule sinks waive that rule. */
export const WAIVE_AFTER = 3;

/** Body rules the shopper has overruled, by the rule's reason text, and the pieces counting toward it. */
export type Waivers = { hits: Record<string, string[]>; waived: string[] };
export const noWaivers: Waivers = { hits: {}, waived: [] };

/**
 * A save or Shop tap on a piece these rules sink. Opens don't count: looking
 * at a sunk piece is curiosity. After three different pieces the rule is
 * waived for good, until they turn it back on in Your style.
 */
export function noteOverrule(
  w: Waivers,
  itemId: string,
  sinking: string[],
): Waivers {
  const hits = { ...w.hits };
  const waived = new Set(w.waived);
  let changed = false;
  for (const rule of sinking) {
    if (waived.has(rule) || hits[rule]?.includes(itemId)) continue;
    changed = true;
    const ids = [...(hits[rule] ?? []), itemId];
    if (ids.length >= WAIVE_AFTER) {
      waived.add(rule);
      delete hits[rule];
    } else hits[rule] = ids;
  }
  // Unchanged, the same object back: the feed restarts when `waived` changes.
  if (!changed) return w;
  return {
    hits,
    waived: waived.size === w.waived.length ? w.waived : [...waived],
  };
}

/** Turning a waived rule back on starts its count over. */
export function restoreRule(w: Waivers, rule: string): Waivers {
  return { hits: w.hits, waived: w.waived.filter((r) => r !== rule) };
}
