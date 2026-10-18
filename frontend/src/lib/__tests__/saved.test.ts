import AsyncStorage from "@react-native-async-storage/async-storage";
import { findItem, rememberItems, type CatalogItem } from "@/data/catalog";
import { useSaved } from "@/store/saved";

describe("saved store", () => {
  beforeEach(() => useSaved.getState().clear());

  it("saves newest first and unsaves from every list", () => {
    const s = useSaved.getState();
    s.toggle("a");
    s.toggle("b");
    const list = s.createList("Fall", "a");
    expect(useSaved.getState().itemIds).toEqual(["a", "b"]);

    useSaved.getState().toggle("a");
    const after = useSaved.getState();
    expect(after.itemIds).toEqual(["b"]);
    expect(after.lists.find((l) => l.id === list)!.itemIds).toEqual([]);
  });

  it("adding to a list saves the item", () => {
    const list = useSaved.getState().createList("Work");
    useSaved.getState().toggleInList(list, "c");
    expect(useSaved.getState().itemIds).toEqual(["c"]);
    useSaved.getState().toggleInList(list, "c");
    expect(useSaved.getState().lists[0].itemIds).toEqual([]);
    // Taking it out of a list keeps it saved.
    expect(useSaved.getState().itemIds).toEqual(["c"]);
  });
});

describe("saved live products", () => {
  beforeEach(() => useSaved.getState().clear());

  const live = (id: string): CatalogItem => ({
    id,
    name: "Linen Overshirt",
    brand: "Tide",
    cut: "unisex",
    colors: ["#9CAF88"],
    price: 58,
    priceLabel: "$58.00",
    aspect: 1.25,
    sizeChartId: "",
    imageUrl: "https://cdn.shopify.com/overshirt.jpg",
    productUrl: "https://tide.example/products/linen-overshirt",
    source: "shopify",
    category: "outerwear",
    silhouette: "relaxed",
    sleeve: "long",
    length: "hip",
  });

  it("keeps a bookmark of a saved live product, and drops it when unsaved", () => {
    const item = live("shopify-SAVE1");
    rememberItems([item]);
    useSaved.getState().toggle(item.id);
    expect(useSaved.getState().items[item.id]).toEqual(item);
    useSaved.getState().toggle(item.id);
    expect(useSaved.getState().items[item.id]).toBeUndefined();
  });

  it("bookmarks a live product added through a list", () => {
    const item = live("shopify-SAVE2");
    rememberItems([item]);
    const list = useSaved.getState().createList("Fall", item.id);
    expect(useSaved.getState().items[item.id]).toEqual(item);
    const other = live("shopify-SAVE3");
    rememberItems([other]);
    useSaved.getState().toggleInList(list, other.id);
    expect(useSaved.getState().items[other.id]).toEqual(other);
  });

  it("doesn't keep this week's Popular mark in a bookmark", () => {
    const item = { ...live("shopify-POP"), popular: true };
    rememberItems([item]);
    useSaved.getState().toggle(item.id);
    expect(useSaved.getState().items[item.id].popular).toBeUndefined();
  });

  it("doesn't bookmark bundled demo items; they're always available", () => {
    useSaved.getState().toggle("w-01");
    expect(useSaved.getState().items).toEqual({});
  });

  it("after a restart, saved live products can still be opened", async () => {
    const item = live("shopify-AFTER-RESTART");
    await AsyncStorage.setItem(
      "silo.saved",
      JSON.stringify({
        state: { itemIds: [item.id], lists: [], items: { [item.id]: item } },
        version: 0,
      }),
    );
    expect(findItem(item.id)).toBeUndefined();
    await useSaved.persist.rehydrate();
    expect(findItem(item.id)).toEqual(item);
  });
});
