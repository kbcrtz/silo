import { Alert } from "react-native";
import { create } from "zustand";
import { track } from "@/api/userData";
import { persist } from "zustand/middleware";
import type { CatalogItem } from "@/data/catalog";
import { bodyTraits, sinkingRules } from "@/lib/bodyFit";
import { latestMeasurements } from "@/lib/measurements";
import { tagsOf } from "@/lib/tags";
import {
  credit,
  dismiss,
  emptyLearned,
  noteOverrule,
  noWaivers,
  restoreRule,
  retract,
  type Ledger,
  type Signal,
} from "@/lib/tasteLearn";
import { useMeasurements } from "./measurements";
import { useProfile } from "./profile";
import { useSaved } from "./saved";
import { storage } from "./storage";

/** Hidden items are kept this long a list; older ones may come back. */
const MAX_HIDDEN = 300;

/**
 * Taste bookkeeping that stays on this phone: which item gave how much
 * credit (so open → save → shop isn't counted three times, and unsaving can
 * take it back), and items hidden with "Not for me". Product ids only; the
 * account backs up the decayed totals on the profile instead.
 */
type TasteLocal = {
  ledger: Ledger;
  /** Newest last. */
  hidden: string[];
  clear: () => void;
};

export const useTasteLocal = create<TasteLocal>()(
  persist(
    (set) => ({
      ledger: {},
      hidden: [],
      clear: () => set({ ledger: {}, hidden: [] }),
    }),
    { name: "silo.tasteLocal", storage },
  ),
);

function traitsNow() {
  const { shopFor } = useProfile.getState();
  return bodyTraits(
    latestMeasurements(useMeasurements.getState().entries),
    shopFor,
  );
}

function setTaste(
  patch: NonNullable<ReturnType<typeof useProfile.getState>["taste"]>,
) {
  const { taste, set } = useProfile.getState();
  set({ taste: { ...taste, ...patch } });
}

/** An action on an item: open (3 s on the sheet), first try-on, save or Shop. */
export function recordSignal(
  item: CatalogItem,
  signal: Signal,
  now = new Date(),
) {
  const { taste } = useProfile.getState();
  const local = useTasteLocal.getState();
  const result = credit(
    taste?.learned ?? emptyLearned(now),
    local.ledger,
    tagsOf(item),
    signal,
    now,
  );
  const waivers =
    signal === "save" || signal === "shop"
      ? noteOverrule(
          taste?.waivers ?? noWaivers,
          item.id,
          sinkingRules(item, traitsNow()),
        )
      : taste?.waivers;
  useTasteLocal.setState({ ledger: result.ledger });
  setTaste({ learned: result.learned, ...(waivers && { waivers }) });
}

/** Unsaving takes back the item's credit. */
export function recordUnsave(item: CatalogItem, now = new Date()) {
  const { taste } = useProfile.getState();
  if (!taste?.learned) return;
  const result = retract(
    taste.learned,
    useTasteLocal.getState().ledger,
    tagsOf(item),
    now,
  );
  useTasteLocal.setState({ ledger: result.ledger });
  setTaste({ learned: result.learned });
}

/** "Not for me": hide the item and count its looks against. */
export function notForMe(item: CatalogItem, now = new Date()) {
  const { taste } = useProfile.getState();
  const { hidden } = useTasteLocal.getState();
  useTasteLocal.setState({
    hidden: [...hidden.filter((id) => id !== item.id), item.id].slice(
      -MAX_HIDDEN,
    ),
  });
  setTaste({
    learned: dismiss(taste?.learned ?? emptyLearned(now), tagsOf(item), now),
  });
}

/** Turns a waived body rule back on. */
export function restoreBodyRule(rule: string) {
  const { taste } = useProfile.getState();
  setTaste({ waivers: restoreRule(taste?.waivers ?? noWaivers, rule) });
}

/**
 * Once, when learning first runs: what's already saved counts, at half a
 * save each, since it's older than anything learned from now on.
 */
export function backfillFromSaved(saved: CatalogItem[], now = new Date()) {
  const { taste } = useProfile.getState();
  if (taste?.backfilled) return;
  let learned = taste?.learned ?? emptyLearned(now);
  let ledger = useTasteLocal.getState().ledger;
  for (const item of saved) {
    const r = credit(learned, ledger, tagsOf(item), "backfill", now);
    learned = r.learned;
    ledger = r.ledger;
  }
  useTasteLocal.setState({ ledger });
  setTaste({ learned, backfilled: true });
}

/**
 * Save or unsave, from the item sheet or a card's menu: it reports the save
 * for "popular with your season" and counts toward taste either way.
 */
export function toggleSave(item: CatalogItem, seasonId: string | undefined) {
  if (useSaved.getState().itemIds.includes(item.id)) recordUnsave(item);
  else {
    track("save", item, seasonId);
    recordSignal(item, "save");
  }
  useSaved.getState().toggle(item.id);
}

/**
 * toggleSave, but unsaving an item that's in lists asks first: it comes
 * out of every list too. `onDone` runs once it has saved or unsaved.
 */
export function confirmToggleSave(
  item: CatalogItem,
  seasonId: string | undefined,
  onDone?: () => void,
) {
  const { itemIds, lists } = useSaved.getState();
  const inLists = lists.filter((l) => l.itemIds.includes(item.id)).length;
  const go = () => {
    onDone?.();
    toggleSave(item, seasonId);
  };
  if (!itemIds.includes(item.id) || !inLists) return go();
  Alert.alert(
    "Remove from Saved?",
    `It also comes out of ${inLists === 1 ? "1 list" : `${inLists} lists`}.`,
    [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: go },
    ],
  );
}
