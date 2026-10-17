/** Lengths are stored in cm and weight in kg; units.ts converts for display. */
export type MeasurementType =
  "height" | "weight" | "chest" | "waist" | "hips" | "inseam" | "armLength";

export type MeasurementEntry = {
  id: string;
  type: MeasurementType;
  value: number;
  measuredAt: string;
};

export type Measurements = Partial<Record<MeasurementType, number>>;

export const MEASUREMENT_TYPES: MeasurementType[] = [
  "height",
  "weight",
  "chest",
  "waist",
  "hips",
  "inseam",
  "armLength",
];

export const MEASUREMENT_INFO: Record<
  MeasurementType,
  { label: string; howTo: string }
> = {
  height: {
    label: "Height",
    howTo: "Stand straight against a wall, no shoes.",
  },
  weight: { label: "Weight", howTo: "Morning, before eating." },
  chest: {
    label: "Chest / bust",
    howTo: "Around the fullest part of your chest, tape level under your arms.",
  },
  waist: {
    label: "Waist",
    howTo: "Around your natural waist, the narrowest part of your torso.",
  },
  hips: {
    label: "Hips",
    howTo: "Around the fullest part of your hips and seat.",
  },
  inseam: {
    label: "Inseam",
    howTo: "From your crotch to the floor along the inside of your leg.",
  },
  armLength: {
    label: "Arm length",
    howTo: "From the top of your shoulder to your wrist bone, arm relaxed.",
  },
};

/** Most recent value per type. */
export function latestMeasurements(entries: MeasurementEntry[]): Measurements {
  const latest: Measurements = {};
  const seenAt: Partial<Record<MeasurementType, string>> = {};
  for (const entry of entries) {
    const prev = seenAt[entry.type];
    if (!prev || entry.measuredAt > prev) {
      latest[entry.type] = entry.value;
      seenAt[entry.type] = entry.measuredAt;
    }
  }
  return latest;
}

/** Entries of one type, newest first. */
export function historyFor(
  entries: MeasurementEntry[],
  type: MeasurementType,
): MeasurementEntry[] {
  return entries
    .filter((e) => e.type === type)
    .sort((a, b) => (a.measuredAt < b.measuredAt ? 1 : -1));
}
