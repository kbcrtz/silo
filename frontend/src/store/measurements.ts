import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  MeasurementEntry,
  Measurements,
  MeasurementType,
} from "@/lib/measurements";
import { storage } from "./storage";

type MeasurementsState = {
  /** Full history, never overwritten, so changes over time can be shown. */
  entries: MeasurementEntry[];
  /** Records only the values that changed from the latest ones. */
  record: (values: Measurements, latest: Measurements) => void;
  replaceAll: (entries: MeasurementEntry[]) => void;
};

export const useMeasurements = create<MeasurementsState>()(
  persist(
    (set) => ({
      entries: [],
      record: (values, latest) => {
        const measuredAt = new Date().toISOString();
        const added: MeasurementEntry[] = [];
        for (const [type, value] of Object.entries(values) as [
          MeasurementType,
          number,
        ][]) {
          if (
            value === undefined ||
            Number.isNaN(value) ||
            value === latest[type]
          )
            continue;
          added.push({ id: `${type}-${measuredAt}`, type, value, measuredAt });
        }
        if (added.length) set((s) => ({ entries: [...s.entries, ...added] }));
      },
      replaceAll: (entries) => set({ entries }),
    }),
    { name: "silo.measurements", storage },
  ),
);
