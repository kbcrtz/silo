import { useMemo, useState } from "react";
import { ScrollView, View } from "react-native";
import { Chip } from "@/components/Chip";
import { MasonryGrid } from "@/components/MasonryGrid";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import {
  CATALOG,
  CATEGORY_LABELS,
  type Category,
  type CatalogItem,
} from "@/data/catalog";
import { paletteMatch } from "@/lib/paletteMatch";
import { useProfile, type ShopFor } from "@/store/profile";
import { useTheme } from "@/theme";

const CATEGORIES = Object.keys(CATEGORY_LABELS) as Category[];

function forShopper(item: CatalogItem, shopFor: ShopFor) {
  return shopFor === "both" || item.cut === "unisex" || item.cut === shopFor;
}

export default function Discover() {
  const t = useTheme();
  const shopFor = useProfile((s) => s.shopFor);
  const [category, setCategory] = useState<Category | null>(null);

  const entries = useMemo(() => {
    const items = CATALOG.filter(
      (i) => forShopper(i, shopFor) && (!category || i.category === category),
    );
    if (!t.season) return items.map((item) => ({ item }));
    const season = t.season;
    return items
      .map((item) => ({ item, match: paletteMatch(item.colors, season) }))
      .sort((a, b) => b.match.score - a.match.score);
  }, [shopFor, category, t.season]);

  return (
    <Screen>
      <View style={{ gap: t.space(1) }}>
        <Text variant="title">Discover</Text>
        <Text tone="muted">
          {t.season
            ? `Picked for your ${t.season.name} palette`
            : "Finish color analysis to personalize this feed"}
        </Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: t.space(2) }}
      >
        <Chip
          label="All"
          selected={!category}
          onPress={() => setCategory(null)}
        />
        {CATEGORIES.map((c) => (
          <Chip
            key={c}
            label={CATEGORY_LABELS[c]}
            selected={category === c}
            onPress={() => setCategory(c)}
          />
        ))}
      </ScrollView>
      {entries.length ? (
        <MasonryGrid entries={entries} />
      ) : (
        <Text tone="muted">Nothing here for this filter yet.</Text>
      )}
    </Screen>
  );
}
