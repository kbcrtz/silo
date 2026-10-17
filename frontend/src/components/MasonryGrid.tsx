import { useState } from "react";
import { View } from "react-native";
import type { CatalogItem } from "@/data/catalog";
import type { PaletteMatch } from "@/lib/paletteMatch";
import { useTheme } from "@/theme";
import { ItemCard } from "./ItemCard";

type Entry = { item: CatalogItem; match?: PaletteMatch };

/**
 * Two-column Pinterest-style grid. Each item goes into whichever column is
 * currently shorter, so rank order is roughly preserved top to bottom. Fine
 * for a catalog of dozens; swap for a virtualized list once it is hundreds.
 */
export function MasonryGrid({ entries }: { entries: Entry[] }) {
  const t = useTheme();
  const gap = t.space(3);
  const [width, setWidth] = useState(0);
  const columnWidth = (width - gap) / 2;

  const columns: Entry[][] = [[], []];
  const heights = [0, 0];
  for (const entry of entries) {
    const col = heights[0] <= heights[1] ? 0 : 1;
    columns[col].push(entry);
    heights[col] += entry.item.aspect + 0.25; // + caption
  }

  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={{ flexDirection: "row", gap }}
    >
      {width > 0 &&
        columns.map((column, i) => (
          <View key={i} style={{ flex: 1, gap: t.space(4) }}>
            {column.map(({ item, match }) => (
              <ItemCard
                key={item.id}
                item={item}
                width={columnWidth}
                match={match}
              />
            ))}
          </View>
        ))}
    </View>
  );
}
