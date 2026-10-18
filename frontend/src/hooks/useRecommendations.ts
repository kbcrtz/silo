import { useMemo } from "react";
import { latestMeasurements } from "@/lib/measurements";
import { useMeasurements } from "@/store/measurements";

export function useLatestMeasurements() {
  const entries = useMeasurements((s) => s.entries);
  return useMemo(() => latestMeasurements(entries), [entries]);
}
