import { router, useLocalSearchParams } from "expo-router";
import { SymbolView, type SFSymbol } from "expo-symbols";
import * as Haptics from "expo-haptics";
import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { AiTryOn } from "@/components/AiTryOn";
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
import { bodyFit, bodyTraits, hasTraits } from "@/lib/bodyFit";
import { bodyShape } from "@/lib/bodyShape";
import { recommendSize } from "@/lib/fit";
import { upperGirth } from "@/lib/measurements";
import { tryOnImageSource } from "@/api/catalog";
import { track } from "@/api/userData";
import { openProduct } from "@/lib/shop";
import { tagsOf } from "@/lib/tags";
import { tasteModel, tasteReason } from "@/lib/tasteLearn";
import { useProfile } from "@/store/profile";
import { useSaved } from "@/store/saved";
import { confirmToggleSave, notForMe, recordSignal } from "@/store/taste";
import { useTheme } from "@/theme";
import { BRAND } from "@/theme/brand";

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
      accessibilityState={
        active === undefined ? undefined : { selected: active }
      }
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

/** How long the sheet must stay up for an open to count toward taste. */
const OPEN_DWELL_MS = 3000;

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
  const body = useMemo(() => bodyTraits(latest, shopFor), [latest, shopFor]);
  const fitPreference = useProfile((s) => s.fitPreference);
  const saved = useSaved((s) => (item ? s.itemIds.includes(item.id) : false));
  const lists = useSaved((s) => s.lists);
  const [onYou, setOnYou] = useState(false);
  const [triedOn, setTriedOn] = useState(false);
  const [failedUri, setFailedUri] = useState<string>();
  const backdrop = useSeasonBackdrop();
  const taste = useProfile((s) => s.taste);
  const waived = useMemo(
    () => new Set(taste?.waivers?.waived ?? []),
    [taste?.waivers],
  );

  // Counted once per sheet open, for "popular with your season".
  useEffect(() => {
    if (item) track("open", item, t.season?.id);
  }, [item?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // An open counts toward taste after 3 s on the sheet; a quick bounce says
  // nothing, and an item already saved has said its piece.
  useEffect(() => {
    if (!item || useSaved.getState().itemIds.includes(item.id)) return;
    const timer = setTimeout(() => recordSignal(item, "open"), OPEN_DWELL_MS);
    return () => clearTimeout(timer);
  }, [item?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!item) {
    return (
      <View style={{ padding: t.space(5) }}>
        <Text variant="title">Item not found</Text>
      </View>
    );
  }

  // Live listings: the cut is estimated from the title.
  const estimated = item.source ? "≈ " : "";
  const fit = hasTraits(body) ? bodyFit(item, body, waived) : null;
  const tasteLine = tasteReason(
    tagsOf(item),
    tasteModel(taste?.stated, taste?.learned),
  );
  const chart = SIZE_CHARTS[item.sizeChartId];
  const size = chart ? recommendSize(latest, chart, fitPreference) : null;
  const measured = upperGirth(latest) && latest.waist && latest.hips;

  // Live products show the AI try-on image; demo items and mock mode the drawn mannequin.
  const aiSource = tryOnImageSource(item, shopFor, latest);
  const showsAi = !!aiSource && aiSource.uri !== failedUri;
  const drawn = (
    <Mannequin
      measurements={latest}
      shopFor={shopFor}
      item={item}
      height={VISUAL_HEIGHT - t.space(14)}
    />
  );

  const toggleSave = () => {
    // Unsaving an item in lists asks first: it comes out of them too.
    confirmToggleSave(item, t.season?.id, () =>
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
    );
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
          {onYou && aiSource ? (
            <View
              style={{
                position: "absolute",
                inset: 0,
                backgroundColor: BRAND.white,
              }}
            />
          ) : onYou ? (
            <BackdropFill id={backdrop} />
          ) : null}
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
              {aiSource ? (
                <AiTryOn
                  key={aiSource.uri}
                  source={aiSource}
                  fallback={drawn}
                  onFailed={() => setFailedUri(aiSource.uri)}
                />
              ) : (
                drawn
              )}
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
                {showsAi
                  ? "AI preview of this item"
                  : measured
                    ? `${estimated}${SILHOUETTE_LABELS[item.silhouette]} cut on your ${shape?.name.toLowerCase()} shape`
                    : "Average figure · add measurements for yours"}
                {!showsAi && item.source
                  ? " · cut estimated from the listing"
                  : ""}
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
          <Pill label={SILHOUETTE_LABELS[item.silhouette]} />
          {item.popular && t.season ? (
            <Pill label={`Popular with ${t.season.name}s this week`} />
          ) : null}
        </View>
        {fit?.reason ? <Text tone="muted">{fit.reason}.</Text> : null}
        {tasteLine ? <Text tone="muted">{tasteLine}.</Text> : null}
        {item.evidence ? (
          <Text variant="caption" tone="muted">
            From the listing: {item.evidence}
          </Text>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityHint="Hides it and shows fewer like it"
          hitSlop={8}
          onPress={() => {
            Haptics.selectionAsync();
            notForMe(item);
            router.back();
          }}
          style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
        >
          <SymbolView
            name="hand.thumbsdown"
            size={14}
            tintColor={t.colors.textMuted}
            style={{ width: 16, height: 16 }}
          />
          <Text variant="caption" tone="muted">
            Not for me
          </Text>
        </Pressable>

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
          onPress={() => {
            setFailedUri(undefined); // reopening tries the AI image again
            // The first try-on counts toward taste; flipping back and forth doesn't add more.
            if (!onYou && !triedOn) {
              setTriedOn(true);
              recordSignal(item, "tryon");
            }
            setOnYou((v) => !v);
          }}
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
            recordSignal(item, "shop");
            openProduct(shopUrl(item), t.colors.accentText);
          }}
        />
      </View>
    </View>
  );
}
