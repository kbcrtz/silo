import type { Backup } from "@/api/userData";
import { rememberItems, type CatalogItem } from "@/data/catalog";
import { entriesFromBackup, isEmptyInstall } from "@/lib/cloud";
import { useMeasurements } from "./measurements";
import { useProfile } from "./profile";
import { useSaved } from "./saved";

export const installIsEmpty = () =>
  isEmptyInstall(
    useProfile.getState(),
    useMeasurements.getState().entries.length,
    useSaved.getState().itemIds.length,
  );

/** Puts a server copy on the phone. The profile merges, so the local selfie stays. */
export function applyBackup(backup: Backup) {
  if (backup.profile) useProfile.setState(backup.profile);
  if (backup.saved) {
    useSaved.setState(backup.saved);
    rememberItems(
      Object.values((backup.saved.items ?? {}) as Record<string, CatalogItem>),
    );
  }
  if (backup.measurements.length)
    useMeasurements
      .getState()
      .replaceAll(entriesFromBackup(backup.measurements));
}

/** Empties the phone: profile, measurements and saved items. */
export function clearLocalData() {
  useMeasurements.getState().replaceAll([]);
  useSaved.getState().clear();
  useProfile.getState().reset();
}
