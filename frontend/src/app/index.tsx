import { Link } from "expo-router";
import { SymbolView, type SFSymbol } from "expo-symbols";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { Chip } from "@/components/Chip";
import { MasonryGrid } from "@/components/MasonryGrid";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { CATEGORY_LABELS, type Category } from "@/data/catalog";
import { useRecommendations } from "@/hooks/useRecommendations";
import { useSaved } from "@/store/saved";
import { useTheme } from "@/theme";

const CATEGORIES = Object.keys(CATEGORY_LABELS) as Category[];

function BarButton({
  href,
  icon,
  label,
  badge,
}: {
  href: "/saved" | "/profile";
  icon: SFSymbol;
  label: string;
  badge?: number;
}) {
  const t = useTheme();
  return (
    <Link href={href} asChild>
      <Pressable
        accessibilityLabel={label}
        hitSlop={8}
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: t.colors.surface,
          borderWidth: 1,
          borderColor: t.colors.border,
        }}
      >
        <SymbolView
          name={icon}
          size={20}
          tintColor={t.colors.accentText}
          style={{ width: 20, height: 20 }}
        />
        {badge ? (
          <View
            style={{
              position: "absolute",
              top: -2,
              right: -2,
              minWidth: 18,
              height: 18,
              borderRadius: 9,
              paddingHorizontal: 4,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: t.colors.accent,
            }}
          >
            <Text variant="caption" tone="onAccent" style={{ fontSize: 11 }}>
              {badge}
            </Text>
          </View>
        ) : null}
      </Pressable>
    </Link>
  );
}

/** The app's one home screen: the feed, with Saved and Profile in its top bar. */
export default function Home() {
  const t = useTheme();
  const { ranked, shape, season } = useRecommendations();
  const savedCount = useSaved((s) => s.itemIds.length);
  const [category, setCategory] = useState<Category | null>(null);

  const entries = useMemo(
    () =>
      ranked
        .filter((r) => !category || r.item.category === category)
        .map((r) => ({
          item: r.item,
          score: r.color || r.silhouette ? r.score : undefined,
        })),
    [ranked, category],
  );

  const pickedFor = [
    season ? `your ${season.name} palette` : null,
    shape ? `${shape.name.toLowerCase()} shape` : null,
  ]
    .filter(Boolean)
    .join(" and ");

  return (
    <Screen>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <BarButton
          href="/saved"
          icon="heart"
          label="Saved"
          badge={savedCount}
        />
        <Text variant="title" style={{ letterSpacing: 2 }}>
          SILO
        </Text>
        <BarButton
          href="/profile"
          icon="person.text.rectangle"
          label="Profile"
        />
      </View>

      <Text tone="muted" style={{ textAlign: "center" }}>
        {pickedFor
          ? `Picked for ${pickedFor}`
          : "Finish color analysis to personalize this feed"}
      </Text>

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
