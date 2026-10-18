import { create } from "zustand";
import { persist } from "zustand/middleware";
import { findItem, rememberItems, type CatalogItem } from "@/data/catalog";
import { storage } from "./storage";

export type SavedList = {
  id: string;
  name: string;
  /** Newest first. */
  itemIds: string[];
  createdAt: string;
};

type SavedState = {
  /** Every saved item, newest first. This is the "All saved" list. */
  itemIds: string[];
  lists: SavedList[];
  /**
   * Bookmarks of saved live Shopify products (title, store link, image link,
   * cut), so saved lists still open them after a restart. Only items the user
   * saved; the feed itself is never stored.
   */
  items: Record<string, CatalogItem>;

  toggle: (itemId: string) => void;
  /** Creates the list and returns its id. */
  createList: (name: string, firstItemId?: string) => string;
  /** Adding to a list also saves the item. */
  toggleInList: (listId: string, itemId: string) => void;
  deleteList: (listId: string) => void;
  clear: () => void;
};

const front = (ids: string[], id: string) => [
  id,
  ...ids.filter((x) => x !== id),
];

/** `items` plus a bookmark for `id` when it's a live product. */
function bookmark(items: Record<string, CatalogItem>, id: string) {
  const item = findItem(id);
  return item?.source ? { ...items, [id]: item } : items;
}

function unbookmark(items: Record<string, CatalogItem>, id: string) {
  const { [id]: _, ...rest } = items;
  return rest;
}

export const useSaved = create<SavedState>()(
  persist(
    (set) => ({
      itemIds: [],
      lists: [],
      items: {},
      toggle: (itemId) =>
        set((s) =>
          s.itemIds.includes(itemId)
            ? {
                // Unsaving takes it out of every list too.
                itemIds: s.itemIds.filter((x) => x !== itemId),
                lists: s.lists.map((l) => ({
                  ...l,
                  itemIds: l.itemIds.filter((x) => x !== itemId),
                })),
                items: unbookmark(s.items, itemId),
              }
            : {
                itemIds: front(s.itemIds, itemId),
                items: bookmark(s.items, itemId),
              },
        ),
      createList: (name, firstItemId) => {
        const id = `list-${Date.now().toString(36)}`;
        set((s) => ({
          lists: [
            ...s.lists,
            {
              id,
              name,
              itemIds: firstItemId ? [firstItemId] : [],
              createdAt: new Date().toISOString(),
            },
          ],
          itemIds: firstItemId ? front(s.itemIds, firstItemId) : s.itemIds,
          items: firstItemId ? bookmark(s.items, firstItemId) : s.items,
        }));
        return id;
      },
      toggleInList: (listId, itemId) =>
        set((s) => {
          const list = s.lists.find((l) => l.id === listId);
          if (!list) return s;
          const inList = list.itemIds.includes(itemId);
          return {
            lists: s.lists.map((l) =>
              l.id === listId
                ? {
                    ...l,
                    itemIds: inList
                      ? l.itemIds.filter((x) => x !== itemId)
                      : front(l.itemIds, itemId),
                  }
                : l,
            ),
            itemIds:
              inList || s.itemIds.includes(itemId)
                ? s.itemIds
                : front(s.itemIds, itemId),
            items: inList ? s.items : bookmark(s.items, itemId),
          };
        }),
      deleteList: (listId) =>
        set((s) => ({ lists: s.lists.filter((l) => l.id !== listId) })),
      clear: () => set({ itemIds: [], lists: [], items: {} }),
    }),
    {
      name: "silo.saved",
      storage,
      // Make bookmarked live products findable again after a restart.
      onRehydrateStorage: () => (state) =>
        rememberItems(Object.values(state?.items ?? {})),
    },
  ),
);
