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

/** A fit kept in the closet, to try on again without picking it. */
export type Outfit = {
  id: string;
  name: string;
  /** Inner layers first, as fitIds gives them. */
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
  /** Newest first. Their live pieces stay bookmarked even once unsaved. */
  outfits: Outfit[];

  toggle: (itemId: string) => void;
  /** Creates the list and returns its id. */
  createList: (name: string, firstItemId?: string) => string;
  /** Adding to a list also saves the item. */
  toggleInList: (listId: string, itemId: string) => void;
  deleteList: (listId: string) => void;
  /** Saves the outfit and returns its id. */
  saveOutfit: (name: string, itemIds: string[]) => string;
  renameOutfit: (outfitId: string, name: string) => void;
  deleteOutfit: (outfitId: string) => void;
  clear: () => void;
};

const front = (ids: string[], id: string) => [
  id,
  ...ids.filter((x) => x !== id),
];

/** `items` plus a bookmark for `id` when it's a live product. */
function bookmark(items: Record<string, CatalogItem>, id: string) {
  const item = findItem(id);
  // "Popular" is this week's; a bookmark outlives it.
  return item?.source
    ? { ...items, [id]: { ...item, popular: undefined } }
    : items;
}

function unbookmark(items: Record<string, CatalogItem>, id: string) {
  const { [id]: _, ...rest } = items;
  return rest;
}

/** Names come from Alert.prompt, which has no length limit; long ones break the headline and chips. */
const short = (name: string) => name.slice(0, 30);

const inOutfit = (outfits: Outfit[], id: string) =>
  outfits.some((o) => o.itemIds.includes(id));

export const useSaved = create<SavedState>()(
  persist(
    (set) => ({
      itemIds: [],
      lists: [],
      items: {},
      outfits: [],
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
                items: inOutfit(s.outfits, itemId)
                  ? s.items
                  : unbookmark(s.items, itemId),
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
              name: short(name),
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
      saveOutfit: (name, itemIds) => {
        const id = `outfit-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
        set((s) => ({
          outfits: [
            {
              id,
              name: short(name),
              itemIds,
              createdAt: new Date().toISOString(),
            },
            ...s.outfits,
          ],
          items: itemIds.reduce(bookmark, s.items),
        }));
        return id;
      },
      renameOutfit: (outfitId, name) =>
        set((s) => ({
          outfits: s.outfits.map((o) =>
            o.id === outfitId ? { ...o, name: short(name) } : o,
          ),
        })),
      deleteOutfit: (outfitId) =>
        set((s) => {
          const outfits = s.outfits.filter((o) => o.id !== outfitId);
          const gone = s.outfits.find((o) => o.id === outfitId)?.itemIds ?? [];
          return {
            outfits,
            items: gone
              .filter((id) => !s.itemIds.includes(id) && !inOutfit(outfits, id))
              .reduce(unbookmark, s.items),
          };
        }),
      clear: () => set({ itemIds: [], lists: [], items: {}, outfits: [] }),
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
