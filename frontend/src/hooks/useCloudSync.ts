import { useEffect } from "react";
import {
  backupMeasurements,
  backupProfile,
  backupSaved,
  fetchBackup,
  uploadPhoto,
} from "@/api/userData";
import {
  measurementRows,
  photoToUpload,
  profileSnapshot,
  savedSnapshot,
} from "@/lib/cloud";
import { photoUri } from "@/lib/photos";
import { useAccount } from "@/store/account";
import { applyBackup, installIsEmpty, restorePhoto } from "@/store/backup";
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

/** On an empty install, puts back what the server has for this user. */
async function restore() {
  const backup = installIsEmpty() ? await fetchBackup() : null;
  if (!backup) return;
  applyBackup(backup);
  await restorePhoto();
}

/**
 * Restores an empty install from the server, then backs everything up now and
 * after every change (profile, the selfie as the passport photo, saved items,
 * measurements). Returns a stop. If the restore fails (offline, a deploy
 * restarting the server), nothing is backed up: an empty phone must never
 * overwrite the account. The next launch or sign-in tries again.
 */
export function startBackups(): () => void {
  let stopped = false;
  let stop = () => {};
  restore().then(
    () => {
      if (stopped) return;
      const jobs = [
        [
          useProfile,
          debounced(() =>
            backupProfile(profileSnapshot(useProfile.getState())),
          ),
        ],
        [
          useProfile,
          debounced(async () => {
            const photo = photoToUpload(useProfile.getState());
            if (!photo) return;
            await uploadPhoto(photoUri(photo));
            useProfile.setState({ photoSynced: photo });
          }),
        ],
        [
          useSaved,
          debounced(() => backupSaved(savedSnapshot(useSaved.getState()))),
        ],
        [
          useMeasurements,
          debounced(() =>
            // The newest 500 (the server's batch limit); older ones are already up, and it skips repeats.
            backupMeasurements(
              measurementRows(useMeasurements.getState().entries.slice(-500)),
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
    },
    () => {},
  );
  return () => {
    stopped = true;
    stop();
  };
}

/**
 * Runs the backups once the stores have loaded, for a signed-in account only:
 * until sign-up everything (the selfie too) stays on the phone, and linking
 * Apple/Google (same user id) starts the first upload. Starts over when the
 * signed-in user changes, and stops while sign-in has it paused.
 */
export function useCloudSync(ready: boolean) {
  const userId = useAccount((s) =>
    s.account.kind === "none" ? undefined : s.account.userId,
  );
  const paused = useAccount((s) => s.syncPaused);
  const member = useAccount((s) => s.account.kind === "member");
  const on = ready && !paused && member;
  useEffect(() => (on ? startBackups() : undefined), [on, userId]);
}
