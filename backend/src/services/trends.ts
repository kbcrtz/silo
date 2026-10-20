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
/**
 * Points needed to count as popular (shop 5, save 3, open 1): one open never is.
 * shortcut: one user can still reach it alone, count distinct users once there are many.
 */
const MIN_SCORE = 6;

export function familyOfHex(hex: string): Family | null {
  return /^#[0-9a-f]{6}$/i.test(hex) ? familyFor(nameForHex(hex)) : null;
}

type Row = { item_id: string; garment: string | null; silhouette: string | null; color_family: string | null; score: number };

export function pickTrending(rows: Row[]): Trending {
  const byItem = new Map<string, number>();
  const byTrait = new Map<string, { trait: Trending["traits"][number]; score: number }>();
  for (const r of rows) {
    byItem.set(r.item_id, (byItem.get(r.item_id) ?? 0) + r.score);
    if (!r.garment || !r.silhouette || !r.color_family) continue;
    const key = `${r.garment}|${r.silhouette}|${r.color_family}`;
    const seen = byTrait.get(key) ?? { trait: { garment: r.garment, silhouette: r.silhouette, family: r.color_family }, score: 0 };
    seen.score += r.score;
    byTrait.set(key, seen);
  }
  return {
    items: [...byItem].filter(([, score]) => score >= MIN_SCORE).sort((a, b) => b[1] - a[1]).slice(0, TOP_ITEMS).map(([id]) => id),
    traits: [...byTrait.values()].filter((t) => t.score >= MIN_SCORE).sort((a, b) => b.score - a.score).slice(0, TOP_TRAITS).map((t) => t.trait),
  };
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
    // Weighted scores (shop 5, save 3, open 1) over the last week, straight from events (indexed on season, at).
    async trending(season) {
      const rows = await sql<Row[]>`
        SELECT item_id, garment, silhouette, color_family,
          sum(CASE kind WHEN 'shop' THEN 5 WHEN 'save' THEN 3 ELSE 1 END)::int AS score
        FROM events
        WHERE season = ${season} AND at > now() - INTERVAL '7 days'
        GROUP BY item_id, garment, silhouette, color_family`;
      return pickTrending(rows);
    },
  };
}
