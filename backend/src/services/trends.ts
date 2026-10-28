import type postgres from "postgres";
import { familyFor, nameForHex, type Family } from "../catalog/colors.ts";
import type { CatalogProduct } from "../catalog/normalize.ts";

export const EVENT_KINDS = ["open", "save", "shop"] as const;

/** What the app reports: an action on an item, with the item's look and the shopper's season. */
export type AppEvent = {
  kind: (typeof EVENT_KINDS)[number];
  itemId: string;
  season?: string;
  garment?: string;
  silhouette?: string;
  family?: Family;
};

/** The last week's favorites for one season: item ids and garment + cut + color family combinations, best first. */
export type Trending = { items: string[]; traits: { garment: string; silhouette: string; family: string }[] };

export type Trends = {
  record(userId: string, events: AppEvent[]): Promise<void>;
  trending(season: string): Promise<Trending>;
};

const TOP_ITEMS = 20;
const TOP_TRAITS = 5;
/** Points needed to count as popular (shop 5, save 3, open 1), each user counted once at their strongest action. */
const MIN_SCORE = 6;
/** So one person tapping can't make anything popular for everyone. */
const MIN_USERS = 2;

export function familyOfHex(hex: string): Family | null {
  return /^#[0-9a-f]{6}$/i.test(hex) ? familyFor(nameForHex(hex)) : null;
}

/** One user's strongest action on one item; `voter` is the user id, or the event id once the account is deleted. */
type Row = { voter: string; item_id: string; garment: string | null; silhouette: string | null; color_family: string | null; score: number };

export function pickTrending(rows: Row[]): Trending {
  type Tally<T> = { value: T; votes: Map<string, number> };
  const byItem = new Map<string, Tally<string>>();
  const byTrait = new Map<string, Tally<Trending["traits"][number]>>();
  const vote = <T>(tallies: Map<string, Tally<T>>, key: string, value: T, r: Row) => {
    const t = tallies.get(key) ?? { value, votes: new Map() };
    t.votes.set(r.voter, Math.max(t.votes.get(r.voter) ?? 0, r.score));
    tallies.set(key, t);
  };
  for (const r of rows) {
    vote(byItem, r.item_id, r.item_id, r);
    if (r.garment && r.silhouette && r.color_family)
      vote(byTrait, `${r.garment}|${r.silhouette}|${r.color_family}`, { garment: r.garment, silhouette: r.silhouette, family: r.color_family }, r);
  }
  const top = <T>(tallies: Map<string, Tally<T>>, n: number) =>
    [...tallies.values()]
      .map((t) => ({ value: t.value, users: t.votes.size, score: [...t.votes.values()].reduce((a, b) => a + b, 0) }))
      .filter((t) => t.score >= MIN_SCORE && t.users >= MIN_USERS)
      .sort((a, b) => b.score - a.score)
      .slice(0, n)
      .map((t) => t.value);
  return { items: top(byItem, TOP_ITEMS), traits: top(byTrait, TOP_TRAITS) };
}

export function isPopular(p: { itemId: string; garment?: string; silhouette?: string; family?: string | null }, t: Trending): boolean {
  if (t.items.includes(p.itemId)) return true;
  return t.traits.some((x) => x.garment === p.garment && x.silhouette === p.silhouette && x.family === p.family);
}

/** Marks feed products that are popular with the season and moves them to the front, keeping order otherwise. */
export function markPopular(products: CatalogProduct[], t: Trending): CatalogProduct[] {
  const popular = products.filter((p) =>
    isPopular(
      {
        // The app's id for a live item (frontend/src/lib/liveItem.ts).
        itemId: `shopify-${p.id.split("/").pop()}`,
        garment: p.estimate?.cut.category,
        silhouette: p.estimate?.cut.silhouette,
        family: familyOfHex(p.estimate?.hex ?? p.color?.hex ?? ""),
      },
      t,
    ),
  );
  for (const p of popular) p.popular = true;
  return [...popular, ...products.filter((p) => !p.popular)];
}

export function createTrends(sql: postgres.Sql): Trends {
  return {
    async record(userId, events) {
      if (!events.length) return;
      const rows = events.map((e) => ({
        user_id: userId,
        kind: e.kind,
        item_id: e.itemId,
        season: e.season ?? null,
        garment: e.garment ?? null,
        silhouette: e.silhouette ?? null,
        color_family: e.family ?? null,
      }));
      await sql`INSERT INTO events ${sql(rows, "user_id", "kind", "item_id", "season", "garment", "silhouette", "color_family")}`;
    },
    // Each user's strongest action per item (shop 5, save 3, open 1) over the last week, straight from events (indexed on season, at).
    // shortcut: one row per user and item reaches Node, move the totals into SQL when a season's week has ~100k of them.
    async trending(season) {
      const rows = await sql<Row[]>`
        SELECT coalesce(user_id::text, id::text) AS voter, item_id, garment, silhouette, color_family,
          max(CASE kind WHEN 'shop' THEN 5 WHEN 'save' THEN 3 ELSE 1 END)::int AS score
        FROM events
        WHERE season = ${season} AND at > now() - INTERVAL '7 days'
        GROUP BY 1, item_id, garment, silhouette, color_family`;
      return pickTrending(rows);
    },
  };
}
