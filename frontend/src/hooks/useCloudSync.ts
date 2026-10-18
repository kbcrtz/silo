import { useEffect } from "react";
import { backupMeasurements, backupProfile, backupSaved } from "@/api/userData";
import { measurementRows, profileSnapshot, savedSnapshot } from "@/lib/cloud";
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

/**
 * Once the stores have loaded, backs them up now and after every change:
 * profile (no selfie), saved items, measurements.
 */
export function useCloudSync(hydrated: boolean) {
  useEffect(() => {
    if (!hydrated) return;
    const jobs = [
      [
        useProfile,
        debounced(() => backupProfile(profileSnapshot(useProfile.getState()))),
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
    return () => {
      unsubs.forEach((u) => u());
      jobs.forEach(([, job]) => job.cancel());
    };
  }, [hydrated]);
}
