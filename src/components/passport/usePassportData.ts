import { useMemo } from "react";
import { SEASONS, type ColorTraits, type Season } from "@/data/seasons";
import { bodyShape } from "@/lib/bodyShape";
import {
  latestMeasurements,
  MEASUREMENT_INFO,
  MEASUREMENT_TYPES,
} from "@/lib/measurements";
import {
  cardNumber,
  formatIssued,
  mrzLines,
  passportName,
} from "@/lib/passport";
import { photoUri } from "@/lib/photos";
import { formatMeasurement } from "@/lib/units";
import { useMeasurements } from "@/store/measurements";
import { useProfile } from "@/store/profile";

export type PassportData = {
  name: string;
  season: Season;
  traits: ColorTraits;
  issued: string;
  number: string;
  selfieUri?: string;
  mrz: [string, string];
  /** Back of the card: label / value pairs. */
  record: { label: string; value: string }[];
};

const CUT_LABEL = {
  womens: "Womenswear",
  mens: "Menswear",
  both: "All cuts",
} as const;

/** Everything the card prints, or null before color analysis exists. */
export function usePassportData(): PassportData | null {
  const displayName = useProfile((s) => s.displayName);
  const selfiePhoto = useProfile((s) => s.selfiePhoto);
  const colorProfile = useProfile((s) => s.colorProfile);
  const fitPreference = useProfile((s) => s.fitPreference);
  const shopFor = useProfile((s) => s.shopFor);
  const unitSystem = useProfile((s) => s.unitSystem);
  const entries = useMeasurements((s) => s.entries);

  return useMemo(() => {
    if (!colorProfile) return null;
    const latest = latestMeasurements(entries);
    const shape = bodyShape(latest);
    const name = passportName(displayName);

    const record = MEASUREMENT_TYPES.map((type) => ({
      label: MEASUREMENT_INFO[type].label,
      value:
        latest[type] !== undefined
          ? formatMeasurement(type, latest[type]!, unitSystem)
          : "—",
    }));
    record.push(
      { label: "Body shape", value: shape?.name ?? "—" },
      {
        label: "Fit",
        value: fitPreference[0].toUpperCase() + fitPreference.slice(1),
      },
      { label: "Shops", value: CUT_LABEL[shopFor] },
    );

    return {
      name,
      season: SEASONS[colorProfile.seasonId],
      traits: colorProfile.traits,
      issued: formatIssued(colorProfile.analyzedAt),
      number: cardNumber(`${colorProfile.analyzedAt}${name}`),
      selfieUri: selfiePhoto ? photoUri(selfiePhoto) : undefined,
      mrz: mrzLines({
        name,
        seasonId: colorProfile.seasonId,
        traits: colorProfile.traits,
        heightCm: latest.height,
        shape: shape?.shape,
      }),
      record,
    };
  }, [
    colorProfile,
    entries,
    displayName,
    selfiePhoto,
    fitPreference,
    shopFor,
    unitSystem,
  ]);
}
