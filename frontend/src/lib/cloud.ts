import type { CatalogItem } from "@/data/catalog";
import type { MeasurementEntry, MeasurementType } from "./measurements";

type State = Record<string, unknown>;

/** Store state minus its action functions, which don't serialize. */
const data = (state: State) =>
  Object.fromEntries(
    Object.entries(state).filter(([, v]) => typeof v !== "function"),
  );

/** The profile as backed up online. The selfie stays on the phone, so its file name isn't sent. */
export function profileSnapshot(state: State): State {
  const { selfiePhoto: _, ...rest } = data(state);
  return rest;
}

export function savedSnapshot(state: State): State {
  return data(state);
}

export function measurementRows(entries: MeasurementEntry[]) {
  return entries.map(({ type, value, measuredAt }) => ({
    type,
    value,
    measuredAt,
  }));
}

export type EventKind = "open" | "save" | "shop";

/** One action for the backend's "popular with your season": the item's look and the season, no personal data. */
export function eventFor(
  kind: EventKind,
  item: CatalogItem,
  season: string | undefined,
) {
  return {
    kind,
    itemId: item.id,
    ...(season && { season }),
    garment: item.category,
    silhouette: item.silhouette,
    ...(item.colors[0] && { color: item.colors[0] }),
  };
}

/**
 * Only an install with nothing on it is restored from the backup: "Redo
 * onboarding" keeps the season and history, and must never be overwritten.
 */
export function isEmptyInstall(
  profile: { onboarded: boolean; colorProfile?: unknown },
  measurementCount: number,
  savedCount: number,
): boolean {
  return (
    !profile.onboarded &&
    !profile.colorProfile &&
    !measurementCount &&
    !savedCount
  );
}

export function entriesFromBackup(
  rows: { type: string; value: number; measuredAt: string }[],
): MeasurementEntry[] {
  return rows.map(({ type, value, measuredAt }) => ({
    id: `${type}-${measuredAt}`,
    type: type as MeasurementType,
    value,
    measuredAt,
  }));
}
