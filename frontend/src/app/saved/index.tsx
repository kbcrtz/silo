import { Link } from "expo-router";
import { Alert, Pressable, View } from "react-native";
import { Button } from "@/components/Button";
import { ProductImage } from "@/components/ItemCard";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { findItem } from "@/data/catalog";
import { useSaved } from "@/store/saved";
import { useTheme } from "@/theme";

/** A list's cover: its four newest items in a 2x2 grid. */
function Mosaic({ itemIds }: { itemIds: string[] }) {
  const t = useTheme();
  const items = itemIds
    .map(findItem)
    .filter((i) => i !== undefined)
    .slice(0, 4);
  return (
    <View
      style={{
        aspectRatio: 1,
        borderRadius: t.radius.md,
        overflow: "hidden",
        flexDirection: "row",
        flexWrap: "wrap",
        backgroundColor: t.colors.border,
        gap: 2,
      }}
    >
      {[0, 1, 2, 3].map((i) => (
        <View
          key={i}
          style={{
            width: "49.5%",
            height: "49.5%",
            backgroundColor: t.colors.surface,
          }}
        >
          {items[i] ? <ProductImage item={items[i]} /> : null}
        </View>
      ))}
    </View>
  );
}

function ListTile({
  id,
  name,
  itemIds,
}: {
  id: string;
  name: string;
  itemIds: string[];
}) {
  const t = useTheme();
  return (
    <Link href={{ pathname: "/saved/[id]", params: { id } }} asChild>
      <Pressable style={{ width: "48%", gap: t.space(2) }}>
        <Mosaic itemIds={itemIds} />
        <View>
          <Text variant="heading" numberOfLines={1}>
            {name}
          </Text>
          <Text variant="caption" tone="muted">
            {itemIds.length} {itemIds.length === 1 ? "item" : "items"}
          </Text>
        </View>
      </Pressable>
    </Link>
  );
}

export default function Saved() {
  const t = useTheme();
  const itemIds = useSaved((s) => s.itemIds);
  const lists = useSaved((s) => s.lists);

  const newList = () =>
    Alert.prompt("New list", undefined, (name) => {
      if (name?.trim()) useSaved.getState().createList(name.trim());
    });

  return (
    <Screen edges={[]}>
      <View style={{ gap: t.space(1) }}>
        <Text variant="title">Saved</Text>
        <Text tone="muted">
          {itemIds.length
            ? "Everything you've hearted, and the lists you've made."
            : "Tap Save on anything in your feed and it lands here."}
        </Text>
      </View>

      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          justifyContent: "space-between",
          rowGap: t.space(5),
        }}
      >
        <ListTile id="all" name="All saved" itemIds={itemIds} />
        {lists.map((list) => (
          <ListTile
            key={list.id}
            id={list.id}
            name={list.name}
            itemIds={list.itemIds}
          />
        ))}
      </View>

      <Button variant="secondary" label="New list" onPress={newList} />
    </Screen>
  );
}
