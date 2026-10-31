import * as Haptics from "expo-haptics";
import { Link } from "expo-router";
import { SymbolView, type SFSymbol } from "expo-symbols";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { FeedCategory } from "@/api/catalog";
import { MasonryGrid } from "@/components/MasonryGrid";
import { Backdrop, useSeasonBackdrop } from "@/components/onboarding/Backdrop";
import { Glass } from "@/components/onboarding/Glass";
import { useDiscover } from "@/hooks/useDiscover";
import { BRAND, FONTS, TYPE } from "@/theme/brand";

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
/** Side margin of the home frame. */
const GUTTER = 18;
/** Where the design frame puts the top row, without a status bar. */
const FRAME_TOP = 28;

function CircleButton({
  href,
  icon,
  label,
}: {
  href: "/saved" | "/profile";
  icon: SFSymbol;
  label: string;
}) {
  return (
    <Link href={href} asChild>
      <Pressable accessibilityLabel={label} hitSlop={8}>
        <Glass
          radius={22}
          fill="rgba(255,255,255,0.42)"
          edge="rgba(255,255,255,0.75)"
          interactive
          style={{
            width: 44,
            height: 44,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <SymbolView
            name={icon}
            size={23}
            weight="light"
            tintColor={BRAND.ink}
            style={{ width: 24, height: 24 }}
          />
        </Glass>
      </Pressable>
    </Link>
  );
}

function CategoryChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
    >
      <Glass
        radius={22}
        fill={selected ? BRAND.ink : "rgba(255,255,255,0.38)"}
        edge="rgba(255,255,255,0.75)"
        // Glass only tints a fill, so the picked category could wash out; ink as in Chip.
        solid={selected}
        interactive
        style={{ height: 44, paddingHorizontal: 17, justifyContent: "center" }}
      >
        <Text
          maxFontSizeMultiplier={1.3}
          style={[
            TYPE.control,
            {
              fontSize: 15.5,
              color: selected ? BRAND.white : "rgba(23,19,17,0.72)",
            },
          ]}
        >
          {label}
        </Text>
      </Glass>
    </Pressable>
  );
}

/** The app's one home screen: the feed over the user's season gradient. */
export default function Home() {
  const insets = useSafeAreaInsets();
  const [category, setCategory] = useState<FeedCategory>("for-you");
  const feed = useDiscover(category);
  const { shape, season } = feed;
  const backdrop = useSeasonBackdrop();

  const entries = useMemo(
    () => feed.entries.map((r) => ({ item: r.item })),
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
    <View style={{ flex: 1 }}>
      <Backdrop id={backdrop} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={200}
        onScroll={({ nativeEvent: e }) => {
          if (
            e.layoutMeasurement.height + e.contentOffset.y >
            e.contentSize.height - LOAD_AHEAD
          )
            feed.loadMore();
        }}
        refreshControl={
          <RefreshControl
            refreshing={loading && feed.mode === "refresh"}
            onRefresh={feed.refresh}
          />
        }
        contentContainerStyle={{
          paddingTop: Math.max(insets.top + 4, FRAME_TOP),
          paddingBottom: insets.bottom + 24,
        }}
      >
        <View style={{ paddingHorizontal: GUTTER }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <CircleButton href="/saved" icon="heart" label="Saved" />
            <Text
              accessibilityRole="header"
              style={{
                fontFamily: FONTS.serifItalic,
                fontSize: 40,
                lineHeight: 48,
                color: BRAND.ink,
              }}
            >
              Silo
            </Text>
            <CircleButton href="/profile" icon="person" label="Profile" />
          </View>

          <Text
            style={[
              TYPE.bodySmall,
              {
                marginTop: 25,
                textAlign: "center",
                color: "rgba(23,19,17,0.6)",
              },
            ]}
          >
            {pickedFor
              ? `Picked for ${pickedFor}.`
              : "Finish color analysis to personalize this feed."}
            {feed.source === "demo" ? " Demo catalog." : ""}
          </Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginTop: 18 }}
          contentContainerStyle={{ gap: 7.5, paddingHorizontal: GUTTER }}
        >
          {CATEGORIES.map(([id, label]) => (
            <CategoryChip
              key={id}
              label={label}
              selected={category === id}
              onPress={() => setCategory(id)}
            />
          ))}
        </ScrollView>

        <View style={{ paddingHorizontal: GUTTER, marginTop: 24 }}>
          {entries.length ? <MasonryGrid entries={entries} /> : null}
          {feed.status === "error" ? (
            <View style={{ alignItems: "center", gap: 12, marginTop: 12 }}>
              <Text
                style={[
                  TYPE.bodySmall,
                  { color: BRAND.inkSoft, textAlign: "center" },
                ]}
              >
                {entries.length
                  ? "Couldn't load more clothes."
                  : "Couldn't reach the store catalog."}
              </Text>
              <CategoryChip
                label="Try again"
                selected={false}
                onPress={feed.retry}
              />
            </View>
          ) : loading && feed.mode !== "refresh" ? (
            <ActivityIndicator
              color={BRAND.inkSoft}
              style={{ marginVertical: 32 }}
            />
          ) : !entries.length ? (
            <Text style={[TYPE.bodySmall, { color: BRAND.inkSoft }]}>
              Nothing here for this filter yet.
            </Text>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}
