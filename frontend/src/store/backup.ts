import { downloadPhoto, type Backup } from "@/api/userData";
import { rememberItems, type CatalogItem } from "@/data/catalog";
import { entriesFromBackup, isEmptyInstall, joinEntries } from "@/lib/cloud";
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

/**
 * An onboarded phone signing in to an account it isn't: it keeps its newer
 * profile and selfie, takes the account's saved items (when it has any), and
 * joins the two measurement histories. The backups then upload the result.
 */
export function joinBackup(backup: Backup) {
  if (backup.saved) {
    useSaved.setState(backup.saved);
    rememberItems(
      Object.values((backup.saved.items ?? {}) as Record<string, CatalogItem>),
    );
  }
  const { entries, replaceAll } = useMeasurements.getState();
  replaceAll(joinEntries(entriesFromBackup(backup.measurements), entries));
}

/** Puts the account's passport photo back as the selfie, when it has one. */
export async function restorePhoto() {
  const photo = await downloadPhoto();
  if (photo) useProfile.setState({ selfiePhoto: photo, photoSynced: photo });
}

/** Empties the phone: profile, measurements and saved items. */
export function clearLocalData() {
  useMeasurements.getState().replaceAll([]);
  useSaved.getState().clear();
  useProfile.getState().reset();
}
