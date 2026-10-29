import { Link } from "expo-router";
import { Alert, Pressable, Text, View } from "react-native";
import { GlassScreen } from "@/components/GlassScreen";
import { ProductImage } from "@/components/ItemCard";
import { GlassButton } from "@/components/onboarding/Buttons";
import { findItem } from "@/data/catalog";
import { useSaved } from "@/store/saved";
import { BRAND, TYPE } from "@/theme/brand";

const RADIUS = 22;

/** A list's cover: its four newest items in a 2x2 grid, on glass. */
function Mosaic({ itemIds }: { itemIds: string[] }) {
  const items = itemIds
    .map(findItem)
    .filter((i) => i !== undefined)
    .slice(0, 4);
  const cell = (i: number) => (
    <View key={i} style={{ flex: 1, backgroundColor: BRAND.glassFill }}>
      {items[i] ? <ProductImage item={items[i]} /> : null}
    </View>
  );
  return (
    <View
      style={{
        aspectRatio: 1,
        borderRadius: RADIUS,
        overflow: "hidden",
        gap: 2,
        backgroundColor: BRAND.glassEdge,
        borderWidth: 1,
        borderColor: BRAND.glassEdge,
      }}
    >
      {[0, 2].map((row) => (
        <View key={row} style={{ flex: 1, flexDirection: "row", gap: 2 }}>
          {cell(row)}
          {cell(row + 1)}
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
  return (
    <Link href={{ pathname: "/saved/[id]", params: { id } }} asChild>
      <Pressable style={{ width: "48%", gap: 10 }}>
        <Mosaic itemIds={itemIds} />
        <View style={{ gap: 2, paddingHorizontal: 4 }}>
          <Text style={[TYPE.control, { fontSize: 16 }]} numberOfLines={1}>
            {name}
          </Text>
          <Text style={[TYPE.caption, { color: BRAND.inkSoft }]}>
            {itemIds.length} {itemIds.length === 1 ? "piece" : "pieces"}
          </Text>
        </View>
      </Pressable>
    </Link>
  );
}

export default function Saved() {
  const itemIds = useSaved((s) => s.itemIds);
  const lists = useSaved((s) => s.lists);

  const newList = () =>
    Alert.prompt("New list", undefined, (name) => {
      if (name?.trim()) useSaved.getState().createList(name.trim());
    });

  return (
    <GlassScreen
      badge="SAVED"
      eyebrow={`${itemIds.length} ${itemIds.length === 1 ? "piece" : "pieces"} saved`}
      title={"Your\n*closet.*"}
      footer={<GlassButton label="New list" onPress={newList} />}
    >
      <Text style={[TYPE.body, { color: BRAND.inkSoft, marginTop: -12 }]}>
        {itemIds.length
          ? "Open a list and tap Try on together to see pieces on you as one fit."
          : "Tap Save on anything in your feed and it lands here."}
      </Text>

      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          justifyContent: "space-between",
          rowGap: 22,
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
    </GlassScreen>
  );
}
