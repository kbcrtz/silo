import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { discoverProducts, type FeedCategory } from "@/api/catalog";
import { rememberItems } from "@/data/catalog";
import { bodyTraits, hasTraits } from "@/lib/bodyFit";
import { toCatalogItem } from "@/lib/liveItem";
import { recommend, type Recommendation } from "@/lib/recommend";
import { tagsOf } from "@/lib/tags";
import {
  feedOrder,
  pickLooks,
  softHidden,
  tasteModel,
  tasteScore,
} from "@/lib/tasteLearn";
import { useProfile } from "@/store/profile";
import { useTasteLocal } from "@/store/taste";
import { useTheme } from "@/theme";
import { useLatestMeasurements } from "./useRecommendations";

type Feed = {
  entries: Recommendation[];
  cursor: string | null;
  source?: "shopify" | "demo";
  status: "loading" | "idle" | "error";
  /** What the current or last request was for. */
  mode: "first" | "more" | "refresh";
};
const START: Feed = {
  entries: [],
  cursor: null,
  status: "loading",
  mode: "first",
};

/**
 * The Discover feed for one category from GET /catalog/discover, in the
 * season's colors, with searches and order steered by the body (lib/bodyFit). One request at a
 * time; a new category, department or season starts over and cancels the old
 * request. Every start and refresh sends a new random seed, so the backend
 * picks different searches and the feed isn't the same each time. Kept in
 * memory only (Shopify's catalog terms forbid storing it).
 */
export function useDiscover(category: FeedCategory) {
  const t = useTheme();
  const shopFor = useProfile((s) => s.shopFor);
  const latest = useLatestMeasurements();
  const body = useMemo(() => bodyTraits(latest, shopFor), [latest, shopFor]);
  // Editing the style restarts the feed; it changes which searches run.
  // Learned taste is read when a page loads instead, so a save doesn't reset the feed.
  const stated = useProfile((s) => s.taste?.stated);
  const waivedList = useProfile((s) => s.taste?.waivers?.waived);
  const waived = useMemo(() => new Set(waivedList ?? []), [waivedList]);
  const style = stated?.colorStyle ?? "none";
  const hidden = useTasteLocal((s) => s.hidden);
  const [feed, setFeed] = useState<Feed>(START);
  const request = useRef<AbortController | null>(null);

  const load = useCallback(
    async (mode: Feed["mode"], cursor?: string) => {
      request.current?.abort();
      const controller = new AbortController();
      request.current = controller;
      setFeed((f) => ({ ...f, status: "loading", mode }));
      const model = tasteModel(stated, useProfile.getState().taste?.learned);
      const seed = cursor ? undefined : Math.floor(Math.random() * 2 ** 31);
      // The looks are picked with the feed's seed, so a refresh can rotate the exploring third.
      const looks =
        seed === undefined
          ? {}
          : pickLooks(model, shopFor, mulberry(seed));
      try {
        const page = await discoverProducts(
          {
            category,
            shopFor,
            style,
            season: t.season,
            cursor,
            // Later pages follow the seed and looks inside the cursor.
            seed,
            body,
            ...looks,
          },
          controller.signal,
        );
        if (controller.signal.aborted) return;
        const items = page.products.map((p) => toCatalogItem(p, shopFor));
        rememberItems(items);
        const scored = recommend(items, t.season, body, waived);
        // Live pages keep the backend's interleaved order (sorting by score
        // bunches near-identical items), but cuts that don't suit the body
        // sink a few places, taste lifts a few, and looks they turned down
        // go to the end.
        const ranked =
          page.source === "demo"
            ? scored
            : feedOrder(
                items.map((i) => scored.find((r) => r.item === i)!),
                (r) => {
                  const tags = tagsOf(r.item);
                  return {
                    fit: r.fit && hasTraits(body) ? r.fit.score : 100,
                    taste: tasteScore(tags, model),
                    hidden: softHidden(tags, model),
                  };
                },
              );
        setFeed((f) => {
          const kept = mode === "more" ? f.entries : [];
          const seen = new Set(kept.map((e) => e.item.id));
          return {
            entries: [...kept, ...ranked.filter((r) => !seen.has(r.item.id))],
            cursor: page.cursor,
            source: page.source,
            status: "idle",
            mode,
          };
        });
      } catch {
        if (!controller.signal.aborted)
          setFeed((f) => ({ ...f, status: "error" }));
      }
    },
    [category, shopFor, t.season, body, stated, style, waived],
  );

  useEffect(() => {
    setFeed(START);
    load("first");
    return () => request.current?.abort();
  }, [load]);

  // "Not for me" takes an item out at once, without reloading.
  const entries = useMemo(() => {
    const gone = new Set(hidden);
    return feed.entries.filter((e) => !gone.has(e.item.id));
  }, [feed.entries, hidden]);

  return {
    ...feed,
    entries,
    body,
    season: t.season,
    loadMore: () => {
      if (feed.status === "idle" && feed.cursor) load("more", feed.cursor);
    },
    refresh: () => load("refresh"),
    retry: () =>
      load(
        feed.mode,
        feed.mode === "more" ? (feed.cursor ?? undefined) : undefined,
      ),
  };
}

/** A small seeded random generator (mulberry32), so a seed picks the same looks every time. */
function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
