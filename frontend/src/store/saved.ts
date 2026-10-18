import { create } from "zustand";
import { persist } from "zustand/middleware";
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

export const useSaved = create<SavedState>()(
  persist(
    (set) => ({
      itemIds: [],
      lists: [],
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
              }
            : { itemIds: front(s.itemIds, itemId) },
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
          };
        }),
      deleteList: (listId) =>
        set((s) => ({ lists: s.lists.filter((l) => l.id !== listId) })),
      clear: () => set({ itemIds: [], lists: [] }),
    }),
    { name: "silo.saved", storage },
  ),
);
