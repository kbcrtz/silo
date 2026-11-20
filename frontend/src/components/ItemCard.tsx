import { Image } from "expo-image";
import { Link } from "expo-router";
import { SymbolView } from "expo-symbols";
import { memo, type ReactNode } from "react";
import { Pressable, View } from "react-native";
import type { CatalogItem } from "@/data/catalog";
import { readableOn } from "@/lib/color";
import { useSaved } from "@/store/saved";
import { confirmToggleSave } from "@/store/taste";
import { useTheme } from "@/theme";
import { BRAND } from "@/theme/brand";
import { GlassPill } from "./GlassPill";
import { Text } from "./Text";

/** Picking pieces: a tap picks the card instead of opening the item. */
export type Pick = { picked: boolean; onPress: () => void };

// Memoized: the feed grows a page at a time, and cards already shown keep their props.
export const ItemCard = memo(function ItemCard({
  item,
  width,
  footer,
  pick,
  onNotForMe,
}: {
  item: CatalogItem;
  width: number;
  /** Below the caption, e.g. a Shop link on saved items. */
  footer?: ReactNode;
  pick?: Pick;
  /** Gives the card the native long-press menu (Save, Not for me), as on the feed. */
  onNotForMe?: () => void;
}) {
  const t = useTheme();
  const saved = useSaved((s) => s.itemIds.includes(item.id));
  const height = width * item.aspect;
  const photo = (
    <>
      <ProductImage item={item} />
      {item.popular ? (
        <View
          style={{
            position: "absolute",
            top: t.space(2),
            left: t.space(2),
          }}
        >
          <GlassPill
            height={24}
            shadow={false}
            style={{ paddingHorizontal: t.space(2) }}
          >
            <Text variant="caption" style={{ color: BRAND.ink }}>
              Popular
            </Text>
          </GlassPill>
        </View>
      ) : null}
      {pick ? (
        <PickMark picked={pick.picked} />
      ) : saved ? (
        // On a dark disc: most product photos are white behind the item.
        <View
          style={{
            position: "absolute",
            top: t.space(2),
            right: t.space(2),
            width: 28,
            height: 28,
            borderRadius: 14,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(23,19,17,0.45)",
          }}
        >
          <SymbolView
            name="heart.fill"
            size={14}
            tintColor={BRAND.white}
            style={{ width: 15, height: 15 }}
          />
        </View>
      ) : null}
    </>
  );
  const photoStyle = {
    height,
    borderRadius: t.radius.md,
    overflow: "hidden",
    backgroundColor: item.colors[0],
  } as const;
  const price = item.priceLabel ?? `$${item.price}`;
  const caption = (
    <View style={{ paddingHorizontal: t.space(1) }}>
      <Text variant="caption" numberOfLines={2}>
        {item.name}
      </Text>
      <Text variant="caption" tone="muted">
        {item.brand} · {price}
      </Text>
      {footer}
    </View>
  );
  const href = { pathname: "/item/[id]", params: { id: item.id } } as const;

  if (onNotForMe && !pick) {
    // iOS's own context menu (Liquid Glass on iOS 26). Only the photo is the
    // trigger, so holding a card lifts the photo alone, not its caption.
    return (
      <View style={{ width, gap: t.space(2) }}>
        <Link href={href} asChild>
          <Link.Trigger>
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={`${item.name}, ${item.brand}, ${price}`}
              accessibilityHint="Hold for Save and Not for me"
              style={photoStyle}
            >
              {photo}
            </Pressable>
          </Link.Trigger>
          <Link.Menu>
            <Link.MenuAction
              title={saved ? "Remove from saved" : "Save"}
              icon={saved ? "heart.slash" : "heart"}
              onPress={() => confirmToggleSave(item, t.season?.id)}
            />
            <Link.MenuAction
              title="Not for me"
              icon="hand.thumbsdown"
              destructive
              onPress={onNotForMe}
            />
          </Link.Menu>
        </Link>
        {/* The caption opens the item too; VoiceOver already has it on the photo. */}
        <Link href={href} asChild>
          <Pressable
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            {caption}
          </Pressable>
        </Link>
      </View>
    );
  }

  const card = (
    <Pressable
      accessibilityState={pick ? { selected: pick.picked } : undefined}
      onPress={pick?.onPress}
      style={{ width, gap: t.space(2) }}
    >
      <View style={photoStyle}>{photo}</View>
      {caption}
    </Pressable>
  );
  if (pick) return card;
  return (
    <Link href={href} asChild>
      {card}
    </Link>
  );
});

const MARK = 26;

/** A picked card gets an ink ring and a check; the rest an empty circle. */
function PickMark({ picked }: { picked: boolean }) {
  return (
    <>
      {picked ? (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            inset: 0,
            borderWidth: 3,
            borderColor: BRAND.ink,
            borderRadius: 14,
          }}
        />
      ) : null}
      <View
        style={{
          position: "absolute",
          top: 8,
          right: 8,
          width: MARK,
          height: MARK,
          borderRadius: MARK / 2,
          alignItems: "center",
          justifyContent: "center",
          borderWidth: 1.5,
          borderColor: picked ? BRAND.ink : BRAND.white,
          backgroundColor: picked ? BRAND.ink : "rgba(23,19,17,0.18)",
        }}
      >
        {picked ? (
          <SymbolView
            name="checkmark"
            size={13}
            weight="bold"
            tintColor={BRAND.white}
            style={{ width: 14, height: 14 }}
          />
        ) : null}
      </View>
    </>
  );
}

/** The product photo, or a color block until the catalog has photos. */
export function ProductImage({ item }: { item: CatalogItem }) {
  return item.imageUrl ? (
    <Image
      source={item.imageUrl}
      style={{ flex: 1 }}
      contentFit="cover"
      transition={200}
      // Shopify catalog images may not be stored: memory only, never disk.
      cachePolicy={item.source ? "memory" : undefined}
    />
  ) : (
    <ColorBlock item={item} />
  );
}

/** Stand-in until catalog items have photos. */
export function ColorBlock({ item }: { item: CatalogItem }) {
  // Live listings can have no photo and no known color.
  const bg = item.colors[0];
  const fg = bg ? readableOn(bg) : BRAND.inkSoft;
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: bg,
      }}
    >
      {item.colors[1] ? (
        <View
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: "30%",
            backgroundColor: item.colors[1],
          }}
        />
      ) : null}
      <SymbolView
        name={item.category === "top" ? "tshirt.fill" : "hanger"}
        size={44}
        tintColor={fg}
        style={{ width: 44, height: 44, opacity: 0.35 }}
      />
    </View>
  );
}
