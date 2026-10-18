import { Image } from "expo-image";
import { Link } from "expo-router";
import { SymbolView } from "expo-symbols";
import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import type { CatalogItem } from "@/data/catalog";
import { readableOn } from "@/lib/color";
import { useSaved } from "@/store/saved";
import { useTheme } from "@/theme";
import { Text } from "./Text";

export function ItemCard({
  item,
  width,
  score,
  footer,
}: {
  item: CatalogItem;
  width: number;
  /** 0-100 recommendation score; the badge is hidden without one. */
  score?: number;
  /** Below the caption, e.g. a Shop link on saved items. */
  footer?: ReactNode;
}) {
  const t = useTheme();
  const saved = useSaved((s) => s.itemIds.includes(item.id));
  const height = width * item.aspect;
  return (
    <Link href={{ pathname: "/item/[id]", params: { id: item.id } }} asChild>
      <Pressable style={{ width, gap: t.space(2) }}>
        <View
          style={{
            height,
            borderRadius: t.radius.md,
            overflow: "hidden",
            backgroundColor: item.colors[0],
          }}
        >
          <ProductImage item={item} />
          {score !== undefined ? (
            <View
              style={{
                position: "absolute",
                top: t.space(2),
                left: t.space(2),
                backgroundColor: "rgba(255,255,255,0.9)",
                borderRadius: t.radius.pill,
                paddingHorizontal: t.space(2),
                paddingVertical: 2,
              }}
            >
              <Text variant="caption" style={{ color: "#141414" }}>
                {score}% match
              </Text>
            </View>
          ) : null}
          {saved ? (
            <SymbolView
              name="heart.fill"
              size={18}
              tintColor="#FFFFFF"
              style={{
                position: "absolute",
                top: t.space(2),
                right: t.space(2),
                width: 18,
                height: 18,
              }}
            />
          ) : null}
        </View>
        <View style={{ paddingHorizontal: t.space(1) }}>
          <Text variant="caption" numberOfLines={2}>
            {item.name}
          </Text>
          <Text variant="caption" tone="muted">
            {item.brand} · ${item.price}
          </Text>
          {footer}
        </View>
      </Pressable>
    </Link>
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
    />
  ) : (
    <ColorBlock item={item} />
  );
}

/** Stand-in until catalog items have photos. */
export function ColorBlock({ item }: { item: CatalogItem }) {
  const fg = readableOn(item.colors[0]);
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
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
