import { useMemo } from "react";
import { CATALOG, type CatalogItem } from "@/data/catalog";
import { bodyShape } from "@/lib/bodyShape";
import { latestMeasurements } from "@/lib/measurements";
import { recommend } from "@/lib/recommend";
import { useMeasurements } from "@/store/measurements";
import { useProfile, type ShopFor } from "@/store/profile";
import { useTheme } from "@/theme";

function forShopper(item: CatalogItem, shopFor: ShopFor) {
  return shopFor === "both" || item.cut === "unisex" || item.cut === shopFor;
}

export function useLatestMeasurements() {
  const entries = useMeasurements((s) => s.entries);
  return useMemo(() => latestMeasurements(entries), [entries]);
}

/** The catalog for this shopper, ranked by their palette and body shape. */
export function useRecommendations() {
  const t = useTheme();
  const shopFor = useProfile((s) => s.shopFor);
  const latest = useLatestMeasurements();
  const shape = useMemo(() => bodyShape(latest), [latest]);

  const ranked = useMemo(
    () =>
      recommend(
        CATALOG.filter((i) => forShopper(i, shopFor)),
        t.season,
        shape?.shape ?? null,
      ),
    [shopFor, t.season, shape],
  );
  return { ranked, shape, season: t.season };
}
