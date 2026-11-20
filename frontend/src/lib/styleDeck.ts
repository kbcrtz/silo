import { aestheticsFor, type Aesthetic } from "@/data/aesthetics";
import type { ShopFor } from "@/store/profile";
import { MAX_LOOKS } from "./taste";

type Dept = "womens" | "mens";

/** One outfit photo in the onboarding swipe deck. */
export type DeckPhoto<Image = unknown> = {
  look: Aesthetic;
  dept: Dept;
  image: Image;
};

/** The photo sets by department and look; a look may have none yet. */
export type DeckPhotos<Image = unknown> = Record<
  Dept,
  Partial<Record<Aesthetic, Image[]>>
>;

/** One swipe: right is liked, left is passed. */
export type Swipe = { look: Aesthetic; liked: boolean };

const DEPTS: Record<ShopFor, Dept[]> = {
  womens: ["womens"],
  mens: ["mens"],
  both: ["womens", "mens"],
};

function shuffle<T>(items: T[], rand: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * The deck for a shopper: every look once in a shuffled first round, then
 * each look's second photo in a second round, so an early pass doesn't
 * decide a look. One department shows its two photos per look; "both"
 * shows each department's first. Never the same look twice in a row.
 */
export function buildDeck<Image>(
  photos: DeckPhotos<Image>,
  shopFor: ShopFor,
  rand: () => number = Math.random,
): DeckPhoto<Image>[] {
  const depts = DEPTS[shopFor];
  const perLook = aestheticsFor(shopFor).map((look) =>
    depts.length === 1
      ? (photos[depts[0]][look] ?? [])
          .slice(0, 2)
          .map((image) => ({ look, dept: depts[0], image }))
      : depts.flatMap((dept) => {
          const image = photos[dept][look]?.[0];
          return image === undefined ? [] : [{ look, dept, image }];
        }),
  );
  const rounds = [0, 1].map((r) =>
    shuffle(
      perLook.flatMap((cards) => (cards[r] ? [cards[r]] : [])),
      rand,
    ),
  );
  const [first, second] = rounds;
  // The second round can't open with the look the first one ended on.
  const last = first[first.length - 1];
  if (last && second[0]?.look === last.look) {
    const swap = second.findIndex((c) => c.look !== last.look);
    if (swap > 0) [second[0], second[swap]] = [second[swap], second[0]];
  }
  return [...first, ...second];
}

/**
 * What the swipes say. A look is liked when it got more rights than lefts,
 * most liked first, up to the picker's three. It's turned down only when
 * every one of at least two photos was passed: a stated rejection keeps
 * the look out of the feed's searches, so one left swipe isn't enough.
 */
export function readSwipes(swipes: Swipe[]): {
  liked: Aesthetic[];
  rejected: Aesthetic[];
} {
  const tally = new Map<Aesthetic, { yes: number; no: number; at: number }>();
  swipes.forEach((s, at) => {
    const t = tally.get(s.look) ?? { yes: 0, no: 0, at };
    if (s.liked) t.yes++;
    else t.no++;
    tally.set(s.look, t);
  });
  const rows = [...tally.entries()];
  const liked = rows
    .filter(([, t]) => t.yes > t.no)
    .sort(([, a], [, b]) => b.yes - b.no - (a.yes - a.no) || a.at - b.at)
    .slice(0, MAX_LOOKS)
    .map(([look]) => look);
  const rejected = rows
    .filter(([, t]) => t.yes === 0 && t.no >= 2)
    .map(([look]) => look);
  return { liked, rejected };
}
