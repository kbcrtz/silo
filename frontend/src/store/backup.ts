import { downloadPhoto, type Backup } from "@/api/userData";
import { rememberItems, type CatalogItem } from "@/data/catalog";
import { entriesFromBackup, isEmptyInstall } from "@/lib/cloud";
import { useFit } from "./fit";
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

/** Puts the account's passport photo back as the selfie, when it has one. */
export async function restorePhoto() {
  const photo = await downloadPhoto();
  if (photo) useProfile.setState({ selfiePhoto: photo, photoSynced: photo });
}

/** Empties the phone: profile, measurements, saved items and the fit. */
export function clearLocalData() {
  useMeasurements.getState().replaceAll([]);
  useSaved.getState().clear();
  useFit.setState({ pieces: {} });
  useProfile.getState().reset();
}
