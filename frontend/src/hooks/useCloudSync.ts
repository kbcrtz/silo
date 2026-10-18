import { useEffect } from "react";
import {
  backupMeasurements,
  backupProfile,
  backupSaved,
  fetchBackup,
} from "@/api/userData";
import { rememberItems, type CatalogItem } from "@/data/catalog";
import {
  entriesFromBackup,
  isEmptyInstall,
  measurementRows,
  profileSnapshot,
  savedSnapshot,
} from "@/lib/cloud";
import { useMeasurements } from "@/store/measurements";
import { useProfile } from "@/store/profile";
import { useSaved } from "@/store/saved";

/** Changes come in bursts (onboarding, list edits); one upload per store per pause. */
const DEBOUNCE_MS = 2000;

function debounced(run: () => Promise<unknown>) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const fire = () => {
    clearTimeout(timer);
    // Offline or server down: the phone still has everything, and the next change retries.
    timer = setTimeout(() => run().catch(() => {}), DEBOUNCE_MS);
  };
  return { fire, cancel: () => clearTimeout(timer) };
}

/** On an empty install, puts back what the server has for this phone's device id. */
async function restore() {
  const empty = isEmptyInstall(
    useProfile.getState(),
    useMeasurements.getState().entries.length,
    useSaved.getState().itemIds.length,
  );
  const backup = empty ? await fetchBackup() : null;
  if (!backup) return;
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
 * Once the stores have loaded: restores an empty install from the server,
 * then backs everything up now and after every change (profile without the
 * selfie, saved items, measurements). Restoring first keeps an empty phone
 * from overwriting the server copy.
 */
export function useCloudSync(hydrated: boolean) {
  useEffect(() => {
    if (!hydrated) return;
    let stopped = false;
    let stop = () => {};
    // A failed restore (offline) just starts from the phone's state.
    restore()
      .catch(() => {})
      .then(() => {
        if (stopped) return;
        const jobs = [
          [
            useProfile,
            debounced(() =>
              backupProfile(profileSnapshot(useProfile.getState())),
            ),
          ],
          [
            useSaved,
            debounced(() => backupSaved(savedSnapshot(useSaved.getState()))),
          ],
          [
            useMeasurements,
            debounced(() =>
              backupMeasurements(
                measurementRows(useMeasurements.getState().entries),
              ),
            ),
          ],
        ] as const;
        const unsubs = jobs.map(([store, job]) => {
          job.fire();
          return store.subscribe(job.fire);
        });
        stop = () => {
          unsubs.forEach((u) => u());
          jobs.forEach(([, job]) => job.cancel());
        };
      });
    return () => {
      stopped = true;
      stop();
    };
  }, [hydrated]);
}
