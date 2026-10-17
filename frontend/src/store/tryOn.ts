import { useEffect } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useShallow } from "zustand/react/shallow";
import { getTryOn, type TryOnState } from "@/api/tryOn";
import { storage } from "./storage";

export type TryOnJob = TryOnState & {
  id: string;
  itemId: string;
  /** Body photo file name used for this job. */
  bodyPhoto: string;
  createdAt: string;
};

type TryOnStore = {
  jobs: TryOnJob[];
  add: (job: TryOnJob) => void;
  /** Polls the API once and stores the new state. */
  refresh: (id: string) => Promise<void>;
  remove: (id: string) => void;
  clear: () => void;
};

export const isPending = (job: TryOnJob) =>
  job.status === "queued" || job.status === "running";

export const useTryOn = create<TryOnStore>()(
  persist(
    (set) => ({
      jobs: [],
      add: (job) => set((s) => ({ jobs: [job, ...s.jobs] })),
      refresh: async (id) => {
        let next: TryOnState;
        try {
          next = await getTryOn(id);
        } catch (e) {
          next = {
            status: "failed",
            error: e instanceof Error ? e.message : String(e),
          };
        }
        set((s) => ({
          jobs: s.jobs.map((j) => (j.id === id ? { ...j, ...next } : j)),
        }));
      },
      remove: (id) => set((s) => ({ jobs: s.jobs.filter((j) => j.id !== id) })),
      clear: () => set({ jobs: [] }),
    }),
    { name: "silo.tryon", storage },
  ),
);

const POLL_MS = 1500;

/** Polls every queued/running job. Mounted once, in the root layout. */
export function usePollPendingJobs() {
  const pendingIds = useTryOn(
    useShallow((s) => s.jobs.filter(isPending).map((j) => j.id)),
  );
  const key = pendingIds.join(",");
  useEffect(() => {
    if (!key) return;
    const ids = key.split(",");
    const timer = setInterval(
      () => ids.forEach((id) => useTryOn.getState().refresh(id)),
      POLL_MS,
    );
    return () => clearInterval(timer);
  }, [key]);
}
