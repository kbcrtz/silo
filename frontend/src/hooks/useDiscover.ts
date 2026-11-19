import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { discoverProducts, type FeedCategory } from "@/api/catalog";
import { rememberItems } from "@/data/catalog";
import { bodyTraits, hasTraits, sinkPoorFits } from "@/lib/bodyFit";
import { toCatalogItem } from "@/lib/liveItem";
import { recommend, type Recommendation } from "@/lib/recommend";
import { useProfile } from "@/store/profile";
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
  const [feed, setFeed] = useState<Feed>(START);
  const request = useRef<AbortController | null>(null);

  const load = useCallback(
    async (mode: Feed["mode"], cursor?: string) => {
      request.current?.abort();
      const controller = new AbortController();
      request.current = controller;
      setFeed((f) => ({ ...f, status: "loading", mode }));
      try {
        const page = await discoverProducts(
          {
            category,
            shopFor,
            // No style preference in the profile yet.
            style: "none",
            season: t.season,
            cursor,
            // Later pages follow the seed inside the cursor.
            seed: cursor ? undefined : Math.floor(Math.random() * 2 ** 31),
            body,
          },
          controller.signal,
        );
        if (controller.signal.aborted) return;
        const items = page.products.map((p) => toCatalogItem(p, shopFor));
        rememberItems(items);
        const scored = recommend(items, t.season, body);
        // Live pages keep the backend's interleaved order (sorting by score
        // bunches near-identical items), but cuts that don't suit the body
        // sink a few places.
        const ranked =
          page.source === "demo"
            ? scored
            : sinkPoorFits(
                items.map((i) => scored.find((r) => r.item === i)!),
                (r) => (r.fit && hasTraits(body) ? r.fit.score : 100),
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
    [category, shopFor, t.season, body],
  );

  useEffect(() => {
    setFeed(START);
    load("first");
    return () => request.current?.abort();
  }, [load]);

  return {
    ...feed,
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
