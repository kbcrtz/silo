import { PLAUSIBLE, type MeasurementType } from "./measurements";

export type UnitSystem = "metric" | "imperial";

const CM_PER_IN = 2.54;
const KG_PER_LB = 0.45359237;

export function unitLabel(type: MeasurementType, system: UnitSystem): string {
  if (type === "weight") return system === "metric" ? "kg" : "lb";
  return system === "metric" ? "cm" : "in";
}

/** Stored value (cm / kg) to the number shown in an input. */
export function toDisplay(
  type: MeasurementType,
  value: number,
  system: UnitSystem,
): number {
  if (system === "metric") return round1(value);
  return round1(type === "weight" ? value / KG_PER_LB : value / CM_PER_IN);
}

/** Number typed in an input back to the stored unit (cm / kg). */
export function fromDisplay(
  type: MeasurementType,
  value: number,
  system: UnitSystem,
): number {
  if (system === "metric") return value;
  return type === "weight" ? value * KG_PER_LB : value * CM_PER_IN;
}

/** "172 cm", "5'8\"", "68 kg". */
export function formatMeasurement(
  type: MeasurementType,
  value: number,
  system: UnitSystem,
): string {
  if (type === "height" && system === "imperial") {
    const totalIn = Math.round(value / CM_PER_IN);
    return `${Math.floor(totalIn / 12)}'${totalIn % 12}"`;
  }
  return `${toDisplay(type, value, system)} ${unitLabel(type, system)}`;
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

/** "Use 47–91 in": the plausible range in the user's units, for a value that's out of it. */
export function rangeHint(type: MeasurementType, system: UnitSystem): string {
  const [min, max] = PLAUSIBLE[type];
  return `Use ${Math.ceil(toDisplay(type, min, system))}–${Math.floor(toDisplay(type, max, system))} ${unitLabel(type, system)}`;
}
