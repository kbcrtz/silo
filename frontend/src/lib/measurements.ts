/** Lengths are stored in cm and weight in kg; units.ts converts for display. */
export type MeasurementType =
  | "height"
  | "weight"
  | "chest"
  | "bust"
  | "waist"
  | "hips"
  | "inseam"
  | "armLength";

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
  "bust",
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
    label: "Chest",
    howTo: "Around your upper torso, tape level under your arms.",
  },
  bust: {
    label: "Bust",
    howTo: "Around the fullest point of your bust.",
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

/** The upper-body girth for shape and figure: bust when given, else chest. */
export function upperGirth(m: Measurements): number | undefined {
  return m.bust ?? m.chest;
}

/**
 * Adult ranges in cm/kg. Anything outside is a typo, like feet typed into an
 * inches box, and is ignored rather than drawn or sized from.
 */
export const PLAUSIBLE: Record<MeasurementType, [number, number]> = {
  height: [120, 230],
  weight: [30, 250],
  chest: [60, 170],
  bust: [60, 170],
  waist: [45, 170],
  hips: [60, 180],
  inseam: [50, 105],
  armLength: [40, 85],
};

export function isPlausible(type: MeasurementType, value: number): boolean {
  const [min, max] = PLAUSIBLE[type];
  return value >= min && value <= max;
}

/** Most recent plausible value per type. */
export function latestMeasurements(entries: MeasurementEntry[]): Measurements {
  const latest: Measurements = {};
  const seenAt: Partial<Record<MeasurementType, string>> = {};
  for (const entry of entries) {
    if (!isPlausible(entry.type, entry.value)) continue;
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
