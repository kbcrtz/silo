import { create } from "zustand";
import { persist } from "zustand/middleware";
import { rememberItems, type CatalogItem, type Category } from "@/data/catalog";
import { addToFit, type Fit } from "@/lib/outfit";
import { storage } from "./storage";

type FitState = {
  /** Kept whole, like saved bookmarks, so the fit still opens after a restart. */
  pieces: Fit;
  add: (item: CatalogItem) => void;
  remove: (category: Category) => void;
};

export const useFit = create<FitState>()(
  persist(
    (set) => ({
      pieces: {},
      add: (item) =>
        // "Popular" is this week's; the fit outlives it.
        set((s) => ({
          pieces: addToFit(s.pieces, { ...item, popular: undefined }),
        })),
      remove: (category) =>
        set((s) => {
          const { [category]: _, ...rest } = s.pieces;
          return { pieces: rest };
        }),
    }),
    {
      name: "silo.fit",
      storage,
      // So the item sheet finds live pieces after a restart.
      onRehydrateStorage: () => (state) =>
        rememberItems(Object.values(state?.pieces ?? {})),
    },
  ),
);
