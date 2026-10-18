import { Link } from "expo-router";
import { SymbolView, type SFSymbol } from "expo-symbols";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  View,
} from "react-native";
import type { FeedCategory } from "@/api/catalog";
import { Button } from "@/components/Button";
import { Chip } from "@/components/Chip";
import { MasonryGrid } from "@/components/MasonryGrid";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { useDiscover } from "@/hooks/useDiscover";
import { useSaved } from "@/store/saved";
import { useTheme } from "@/theme";

const CATEGORIES: [FeedCategory, string][] = [
  ["for-you", "For You"],
  ["all", "All"],
  ["tops", "Tops"],
  ["bottoms", "Bottoms"],
  ["jeans", "Jeans"],
  ["shorts", "Shorts"],
  ["sweats", "Sweats"],
  ["dresses", "Dresses"],
  ["outerwear", "Outerwear"],
];
/** Start fetching the next page this far (pt) before the bottom. */
const LOAD_AHEAD = 800;

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
  const savedCount = useSaved((s) => s.itemIds.length);
  const [category, setCategory] = useState<FeedCategory>("for-you");
  const feed = useDiscover(category);
  const { shape, season } = feed;

  const entries = useMemo(
    () =>
      feed.entries.map((r) => ({
        item: r.item,
        score: r.color || r.silhouette ? r.score : undefined,
      })),
    [feed.entries],
  );
  const loading = feed.status === "loading";

  const pickedFor = [
    season ? `your ${season.name} palette` : null,
    shape ? `${shape.name.toLowerCase()} shape` : null,
  ]
    .filter(Boolean)
    .join(" and ");

  return (
    <Screen
      scrollProps={{
        scrollEventThrottle: 200,
        onScroll: ({ nativeEvent: e }) => {
          if (
            e.layoutMeasurement.height + e.contentOffset.y >
            e.contentSize.height - LOAD_AHEAD
          )
            feed.loadMore();
        },
        refreshControl: (
          <RefreshControl
            refreshing={loading && feed.mode === "refresh"}
            onRefresh={feed.refresh}
          />
        ),
      }}
    >
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
        {feed.source === "demo" ? " · demo catalog" : ""}
      </Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: t.space(2) }}
      >
        {CATEGORIES.map(([id, label]) => (
          <Chip
            key={id}
            label={label}
            selected={category === id}
            onPress={() => setCategory(id)}
          />
        ))}
      </ScrollView>
      {entries.length ? <MasonryGrid entries={entries} /> : null}
      {feed.status === "error" ? (
        <View style={{ alignItems: "center", gap: t.space(3) }}>
          <Text tone="muted" style={{ textAlign: "center" }}>
            {entries.length
              ? "Couldn't load more clothes."
              : "Couldn't reach the store catalog."}
          </Text>
          <Button label="Try again" variant="secondary" onPress={feed.retry} />
        </View>
      ) : loading && feed.mode !== "refresh" ? (
        <ActivityIndicator
          color={t.colors.textMuted}
          style={{ marginVertical: t.space(6) }}
        />
      ) : !entries.length ? (
        <Text tone="muted">Nothing here for this filter yet.</Text>
      ) : null}
    </Screen>
  );
}
