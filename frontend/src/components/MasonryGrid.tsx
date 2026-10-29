import { useState, type ReactNode } from "react";
import { View } from "react-native";
import type { CatalogItem } from "@/data/catalog";
import { useTheme } from "@/theme";
import { ItemCard, type Pick } from "./ItemCard";

type Entry = { item: CatalogItem; score?: number };

/**
 * Two-column Pinterest-style grid. Each item goes into whichever column is
 * currently shorter, so rank order is roughly preserved top to bottom. Fine
 * for a catalog of dozens; swap for a virtualized list once it is hundreds.
 */
export function MasonryGrid({
  entries,
  footer,
  pick,
}: {
  entries: Entry[];
  footer?: (item: CatalogItem) => ReactNode;
  /** Turns the grid into a picker; cards stop opening their item. */
  pick?: (item: CatalogItem) => Pick;
}) {
  const t = useTheme();
  const gap = t.space(3);
  const [width, setWidth] = useState(0);
  const columnWidth = (width - gap) / 2;

  const columns: Entry[][] = [[], []];
  const heights = [0, 0];
  for (const entry of entries) {
    const col = heights[0] <= heights[1] ? 0 : 1;
    columns[col].push(entry);
    heights[col] += entry.item.aspect + (footer ? 0.4 : 0.25); // + caption
  }

  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={{ flexDirection: "row", gap }}
    >
      {width > 0 &&
        columns.map((column, i) => (
          <View key={i} style={{ flex: 1, gap: t.space(4) }}>
            {column.map(({ item, score }) => (
              <ItemCard
                key={item.id}
                item={item}
                width={columnWidth}
                score={score}
                footer={footer?.(item)}
                pick={pick?.(item)}
              />
            ))}
          </View>
        ))}
    </View>
  );
}
