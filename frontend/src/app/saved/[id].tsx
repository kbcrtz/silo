import { router, useLocalSearchParams } from "expo-router";
import { Alert, Pressable, View } from "react-native";
import { Button } from "@/components/Button";
import { MasonryGrid } from "@/components/MasonryGrid";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { findItem, shopUrl } from "@/data/catalog";
import { track } from "@/api/userData";
import { openProduct } from "@/lib/shop";
import { useSaved } from "@/store/saved";
import { useTheme } from "@/theme";

/** One saved list, or every saved item when the id is "all". */
export default function SavedList() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTheme();
  const list = useSaved((s) => s.lists.find((l) => l.id === id));
  const allIds = useSaved((s) => s.itemIds);
  const isAll = id === "all";
  const itemIds = isAll ? allIds : (list?.itemIds ?? []);
  const items = itemIds.map(findItem).filter((i) => i !== undefined);

  const deleteList = () =>
    Alert.alert(`Delete "${list?.name}"?`, "The items stay in All saved.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          useSaved.getState().deleteList(id);
          router.back();
        },
      },
    ]);

  if (!isAll && !list) {
    return (
      <Screen edges={[]}>
        <Text variant="title">List not found</Text>
      </Screen>
    );
  }

  return (
    <Screen edges={[]}>
      <View style={{ gap: t.space(1) }}>
        <Text variant="title">{isAll ? "All saved" : list?.name}</Text>
        <Text tone="muted">
          {items.length} {items.length === 1 ? "item" : "items"}
        </Text>
      </View>

      {items.length ? (
        <MasonryGrid
          entries={items.map((item) => ({ item }))}
          footer={(item) => (
            <Pressable
              hitSlop={6}
              onPress={() => {
                track("shop", item, t.season?.id);
                openProduct(shopUrl(item), t.colors.accentText);
              }}
              style={{ marginTop: t.space(1) }}
            >
              <Text variant="caption" tone="accent">
                Shop ›
              </Text>
            </Pressable>
          )}
        />
      ) : (
        <Text tone="muted">
          {isAll
            ? "Nothing saved yet."
            : "Empty for now. Open an item, tap Save, then pick this list."}
        </Text>
      )}

      {!isAll ? (
        <Button variant="ghost" label="Delete list" onPress={deleteList} />
      ) : null}
    </Screen>
  );
}
