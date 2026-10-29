import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Text } from "react-native";
import { GlassRow, GlassSection } from "@/components/GlassList";
import { GlassScreen } from "@/components/GlassScreen";
import { MeasurementForm } from "@/components/MeasurementForm";
import { PrimaryButton } from "@/components/onboarding/Buttons";
import {
  historyFor,
  latestMeasurements,
  MEASUREMENT_INFO,
  MEASUREMENT_TYPES,
  type Measurements,
} from "@/lib/measurements";
import { formatMeasurement, toDisplay, unitLabel } from "@/lib/units";
import { useMeasurements } from "@/store/measurements";
import { useProfile } from "@/store/profile";
import { BRAND, TYPE } from "@/theme/brand";

export default function MeasurementsScreen() {
  const entries = useMeasurements((s) => s.entries);
  const latest = useMemo(() => latestMeasurements(entries), [entries]);
  const unitSystem = useProfile((s) => s.unitSystem);
  const setProfile = useProfile((s) => s.set);
  const [draft, setDraft] = useState<Measurements>(latest);

  const save = () => {
    useMeasurements.getState().record(draft, latest);
    router.back();
  };

  return (
    <GlassScreen
      badge="YOUR FIT"
      eyebrow="Sizes are picked from these"
      title={"Your\n*measurements.*"}
      footer={<PrimaryButton label="Save" arrow={false} onPress={save} />}
    >
      <MeasurementForm
        initial={latest}
        unitSystem={unitSystem}
        onUnitSystemChange={(u) => setProfile({ unitSystem: u })}
        onChange={setDraft}
      />

      {MEASUREMENT_TYPES.map((type) => {
        const history = historyFor(entries, type);
        if (history.length === 0) return null;
        return (
          <GlassSection
            key={type}
            title={`${MEASUREMENT_INFO[type].label} history`}
          >
            {history.map((entry, i) => {
              const older = history[i + 1];
              const delta = older
                ? toDisplay(type, entry.value, unitSystem) -
                  toDisplay(type, older.value, unitSystem)
                : 0;
              return (
                <GlassRow
                  key={entry.id}
                  label={new Date(entry.measuredAt).toLocaleDateString()}
                  detail={
                    older && delta !== 0
                      ? `${delta > 0 ? "+" : "−"}${Math.abs(Math.round(delta * 10) / 10)} ${unitLabel(type, unitSystem)}`
                      : undefined
                  }
                  value={formatMeasurement(type, entry.value, unitSystem)}
                />
              );
            })}
          </GlassSection>
        );
      })}
      {entries.length === 0 ? (
        <Text style={[TYPE.body, { color: BRAND.inkSoft }]}>
          Save your first measurements to start tracking.
        </Text>
      ) : null}
    </GlassScreen>
  );
}
