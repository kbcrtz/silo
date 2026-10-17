import { Image } from "expo-image";
import { Link } from "expo-router";
import { SymbolView } from "expo-symbols";
import { Pressable, View } from "react-native";
import type { CatalogItem } from "@/data/catalog";
import { readableOn } from "@/lib/color";
import type { PaletteMatch } from "@/lib/paletteMatch";
import { useTheme } from "@/theme";
import { Text } from "./Text";

export function ItemCard({
  item,
  width,
  match,
}: {
  item: CatalogItem;
  width: number;
  match?: PaletteMatch;
}) {
  const t = useTheme();
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
          {item.imageUrl ? (
            <Image
              source={item.imageUrl}
              style={{ flex: 1 }}
              contentFit="cover"
              transition={200}
            />
          ) : (
            <ColorBlock item={item} />
          )}
          {match ? (
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
                {match.score}% match
              </Text>
            </View>
          ) : null}
        </View>
        <View style={{ paddingHorizontal: t.space(1) }}>
          <Text variant="caption" numberOfLines={2}>
            {item.name}
          </Text>
          <Text variant="caption" tone="muted">
            {item.brand} · ${item.price}
          </Text>
        </View>
      </Pressable>
    </Link>
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
