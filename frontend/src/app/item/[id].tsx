import { router, useLocalSearchParams } from "expo-router";
import { SymbolView, type SFSymbol } from "expo-symbols";
import * as Haptics from "expo-haptics";
import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { Button } from "@/components/Button";
import { Chip } from "@/components/Chip";
import { GlassPill, PILL_EDGE, PILL_FILL } from "@/components/GlassPill";
import { ProductImage } from "@/components/ItemCard";
import { Mannequin } from "@/components/Mannequin";
import {
  BackdropFill,
  useSeasonBackdrop,
} from "@/components/onboarding/Backdrop";
import { Glass } from "@/components/onboarding/Glass";
import { Text } from "@/components/Text";
import { findItem, shopUrl, SILHOUETTE_LABELS } from "@/data/catalog";
import { SIZE_CHARTS } from "@/data/sizeCharts";
import { useLatestMeasurements } from "@/hooks/useRecommendations";
import { bodyShape } from "@/lib/bodyShape";
import { recommendSize } from "@/lib/fit";
import { paletteMatch } from "@/lib/paletteMatch";
import { track } from "@/api/userData";
import { openProduct } from "@/lib/shop";
import { silhouetteMatch } from "@/lib/silhouette";
import { useProfile } from "@/store/profile";
import { useSaved } from "@/store/saved";
import { useTheme } from "@/theme";

const VISUAL_HEIGHT = 320;
const BAR_HEIGHT = 52;
function Pill({ label }: { label: string }) {
  return (
    <GlassPill height={32} style={{ paddingHorizontal: 13 }}>
      <Text variant="caption">{label}</Text>
    </GlassPill>
  );
}

function IconButton({
  icon,
  label,
  onPress,
  active,
}: {
  icon: SFSymbol;
  label: string;
  onPress: () => void;
  active?: boolean;
}) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
    >
      <GlassPill
        height={BAR_HEIGHT}
        fill={active ? "rgba(23,19,17,0.06)" : undefined}
        interactive
        style={{ gap: t.space(2), paddingHorizontal: t.space(4) }}
      >
        <SymbolView
          name={icon}
          size={18}
          tintColor={t.colors.accentText}
          style={{ width: 18, height: 18 }}
        />
        <Text variant="heading" style={{ fontSize: 15 }}>
          {label}
        </Text>
      </GlassPill>
    </Pressable>
  );
}

/**
 * The item sheet over the feed: photo or the item on the user's mannequin,
 * why it was picked, their size, and Save / Shop.
 */
export default function ItemSheet() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const item = findItem(id);
  const t = useTheme();
  const latest = useLatestMeasurements();
  const shape = useMemo(() => bodyShape(latest), [latest]);
  const shopFor = useProfile((s) => s.shopFor);
  const fitPreference = useProfile((s) => s.fitPreference);
  const saved = useSaved((s) => (item ? s.itemIds.includes(item.id) : false));
  const lists = useSaved((s) => s.lists);
  const [onYou, setOnYou] = useState(false);
  const backdrop = useSeasonBackdrop();

  // Counted once per sheet open, for "popular with your season".
  useEffect(() => {
    if (item) track("open", item, t.season?.id);
  }, [item?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!item) {
    return (
      <View style={{ padding: t.space(5) }}>
        <Text variant="title">Item not found</Text>
      </View>
    );
  }

  const color =
    t.season && item.colors.length ? paletteMatch(item.colors, t.season) : null;
  // Live listings: color comes from the merchant's color name, cut from the title.
  const estimated = item.source ? "≈ " : "";
  const fit = shape ? silhouetteMatch(item.silhouette, shape.shape) : null;
  const chart = SIZE_CHARTS[item.sizeChartId];
  const size = chart ? recommendSize(latest, chart, fitPreference) : null;
  const measured = latest.chest && latest.waist && latest.hips;

  const toggleSave = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!saved) track("save", item, t.season?.id);
    useSaved.getState().toggle(item.id);
  };

  const newList = () =>
    Alert.prompt(
      "New list",
      "Name it, and this item goes in first.",
      (name) => {
        if (name?.trim()) useSaved.getState().createList(name.trim(), item.id);
      },
    );

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={{
          padding: t.space(5),
          paddingTop: t.space(6),
          gap: t.space(4),
        }}
      >
        <View
          style={{
            height: VISUAL_HEIGHT,
            borderRadius: t.radius.lg,
            overflow: "hidden",
            backgroundColor: item.colors[0],
            borderWidth: onYou ? 1 : 0,
            borderColor: PILL_EDGE,
          }}
        >
          {onYou ? <BackdropFill id={backdrop} /> : null}
          {onYou ? (
            <Animated.View
              key="mannequin"
              entering={FadeIn.duration(250)}
              style={{
                flex: 1,
                alignItems: "center",
                paddingTop: t.space(4),
              }}
            >
              <Mannequin
                measurements={latest}
                shopFor={shopFor}
                item={item}
                height={VISUAL_HEIGHT - t.space(14)}
              />
              <Text
                variant="caption"
                tone="muted"
                style={{
                  position: "absolute",
                  bottom: t.space(3),
                  textAlign: "center",
                  paddingHorizontal: t.space(4),
                }}
              >
                {measured
                  ? `${estimated}${SILHOUETTE_LABELS[item.silhouette]} cut on your ${shape?.name.toLowerCase()} shape`
                  : "Average figure · add measurements for yours"}
                {item.source ? " · cut estimated from the listing" : ""}
                {item.evidence ? `\nFrom the listing: ${item.evidence}` : ""}
              </Text>
            </Animated.View>
          ) : (
            <Animated.View
              key="photo"
              entering={FadeIn.duration(250)}
              style={{ flex: 1 }}
            >
              <ProductImage item={item} />
            </Animated.View>
          )}
        </View>

        <View style={{ gap: t.space(1) }}>
          <Text variant="title">{item.name}</Text>
          <Text tone="muted">
            {item.brand} · {item.priceLabel ?? `$${item.price}`}
          </Text>
        </View>

        <View
          style={{ flexDirection: "row", flexWrap: "wrap", gap: t.space(2) }}
        >
          {color && t.season ? (
            <Pill
              label={`${estimated}${color.score}% ${t.season.name} match`}
            />
          ) : null}
          {fit && shape ? (
            <Pill label={`${fit.label} · ${shape.name}`} />
          ) : null}
          <Pill label={SILHOUETTE_LABELS[item.silhouette]} />
          {item.popular && t.season ? (
            <Pill label={`Popular with ${t.season.name}s this week`} />
          ) : null}
        </View>

        {size ? (
          <Glass
            radius={24}
            fill={PILL_FILL}
            edge={PILL_EDGE}
            style={{ paddingVertical: 15, paddingHorizontal: 18 }}
          >
            {size.kind === "size" ? (
              <Text>
                Your size <Text variant="heading">{size.size}</Text>
                <Text tone="muted">
                  {"  ·  "}
                  {size.confidence === "high"
                    ? "Should fit well"
                    : size.confidence === "medium"
                      ? "Close fit"
                      : "Between sizes"}
                </Text>
              </Text>
            ) : (
              <Pressable onPress={() => router.push("/measurements")}>
                <Text tone="accent">Add measurements to get your size ›</Text>
              </Pressable>
            )}
          </Glass>
        ) : null}

        {saved ? (
          <Animated.View entering={FadeIn}>
            <Glass
              radius={24}
              fill={PILL_FILL}
              edge={PILL_EDGE}
              style={{ padding: 16, gap: t.space(3) }}
            >
              <Text variant="caption" tone="muted">
                ADD TO A LIST
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: t.space(2),
                }}
              >
                {lists.map((list) => (
                  <Chip
                    key={list.id}
                    label={list.name}
                    selected={list.itemIds.includes(item.id)}
                    onPress={() =>
                      useSaved.getState().toggleInList(list.id, item.id)
                    }
                  />
                ))}
                <Chip label="+ New list" selected={false} onPress={newList} />
              </View>
            </Glass>
          </Animated.View>
        ) : null}
      </ScrollView>

      <View
        style={{
          flexDirection: "row",
          gap: t.space(2),
          paddingHorizontal: t.space(5),
          paddingTop: t.space(2),
          paddingBottom: t.space(8),
        }}
      >
        <Button
          label={onYou ? "See photo" : "Try it on"}
          onPress={() => setOnYou((v) => !v)}
          style={{ flex: 1 }}
        />
        <IconButton
          icon={saved ? "heart.fill" : "heart"}
          label={saved ? "Saved" : "Save"}
          active={saved}
          onPress={toggleSave}
        />
        <IconButton
          icon="bag"
          label="Shop"
          onPress={() => {
            track("shop", item, t.season?.id);
            openProduct(shopUrl(item), t.colors.accentText);
          }}
        />
      </View>
    </View>
  );
}
