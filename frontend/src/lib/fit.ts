import {
  MEASUREMENT_INFO,
  type MeasurementType,
  type Measurements,
} from "./measurements";

export type FitPreference = "slim" | "regular" | "relaxed";

export type SizeChart = {
  id: string;
  /** Smallest to largest. Ranges are body measurements in cm, inclusive. */
  sizes: {
    label: string;
    ranges: Partial<Record<MeasurementType, [number, number]>>;
  }[];
};

export type SizeRecommendation =
  | {
      kind: "size";
      size: string;
      confidence: "high" | "medium" | "low";
      notes: string[];
    }
  | { kind: "missing"; missing: MeasurementType[] };

/** Within this many cm of the best size, a fit preference may pick a neighbor. */
const PREFERENCE_SLACK_CM = 2;

/**
 * Picks the size whose ranges the user's measurements fall outside of by the
 * least total cm. A slim or relaxed preference then takes the smallest or
 * largest size that is nearly as good, so it nudges the pick without
 * overriding a clearly better fit.
 */
export function recommendSize(
  m: Measurements,
  chart: SizeChart,
  preference: FitPreference = "regular",
): SizeRecommendation {
  const needed = new Set<MeasurementType>();
  chart.sizes.forEach((s) =>
    Object.keys(s.ranges).forEach((k) => needed.add(k as MeasurementType)),
  );
  const missing = [...needed].filter((t) => m[t] === undefined);
  if (missing.length > 0) return { kind: "missing", missing };

  const scored = chart.sizes.map((size, index) => {
    let outside = 0;
    for (const [type, [min, max]] of Object.entries(size.ranges) as [
      MeasurementType,
      [number, number],
    ][]) {
      const v = m[type]!;
      if (v < min) outside += min - v;
      else if (v > max) outside += v - max;
    }
    return { size, index, outside };
  });

  const best = Math.min(...scored.map((s) => s.outside));
  const nearlyBest = scored.filter(
    (s) => s.outside <= best + PREFERENCE_SLACK_CM,
  );
  const pick =
    preference === "slim"
      ? nearlyBest[0]
      : preference === "relaxed"
        ? nearlyBest[nearlyBest.length - 1]
        : scored.find((s) => s.outside === best)!;

  const notes: string[] = [];
  for (const [type, [min, max]] of Object.entries(pick.size.ranges) as [
    MeasurementType,
    [number, number],
  ][]) {
    const label = MEASUREMENT_INFO[type].label.toLowerCase();
    const v = m[type]!;
    if (v > max) notes.push(`May be snug at the ${label}`);
    else if (v < min) notes.push(`May be roomy at the ${label}`);
  }

  const confidence =
    pick.outside === 0 ? "high" : pick.outside <= 4 ? "medium" : "low";
  return { kind: "size", size: pick.size.label, confidence, notes };
}
