import * as Haptics from "expo-haptics";
import { Link } from "expo-router";
import { SymbolView, type SFSymbol } from "expo-symbols";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MasonryGrid } from "@/components/MasonryGrid";
import { Backdrop, useSeasonBackdrop } from "@/components/onboarding/Backdrop";
import { Glass } from "@/components/onboarding/Glass";
import { CATEGORY_LABELS, type Category } from "@/data/catalog";
import { useRecommendations } from "@/hooks/useRecommendations";
import { BRAND, FONTS, TYPE } from "@/theme/brand";

const CATEGORIES = Object.keys(CATEGORY_LABELS) as Category[];
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
        fill={selected ? "rgba(255,255,255,0.62)" : "rgba(255,255,255,0.38)"}
        edge="rgba(255,255,255,0.75)"
        interactive
        style={{ height: 44, paddingHorizontal: 17, justifyContent: "center" }}
      >
        <Text
          style={[
            TYPE.control,
            { fontSize: 15.5, color: "rgba(23,19,17,0.72)" },
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
  const { ranked, shape, season } = useRecommendations();
  const [category, setCategory] = useState<Category | null>(null);
  const backdrop = useSeasonBackdrop();

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
    <View style={{ flex: 1 }}>
      <Backdrop id={backdrop} />
      <ScrollView
        showsVerticalScrollIndicator={false}
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
          </Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginTop: 18 }}
          contentContainerStyle={{ gap: 7.5, paddingHorizontal: GUTTER }}
        >
          <CategoryChip
            label="All"
            selected={!category}
            onPress={() => setCategory(null)}
          />
          {CATEGORIES.map((c) => (
            <CategoryChip
              key={c}
              label={CATEGORY_LABELS[c]}
              selected={category === c}
              onPress={() => setCategory(c)}
            />
          ))}
        </ScrollView>

        <View style={{ paddingHorizontal: GUTTER, marginTop: 24 }}>
          {entries.length ? (
            <MasonryGrid entries={entries} />
          ) : (
            <Text style={[TYPE.bodySmall, { color: BRAND.inkSoft }]}>
              Nothing here for this filter yet.
            </Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
