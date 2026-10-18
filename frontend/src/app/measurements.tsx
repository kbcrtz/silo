import { router } from "expo-router";
import { useMemo, useState } from "react";
import { View } from "react-native";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { MeasurementForm } from "@/components/MeasurementForm";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
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
import { useTheme } from "@/theme";

export default function MeasurementsScreen() {
  const t = useTheme();
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
    <Screen edges={[]} footer={<Button label="Save" onPress={save} />}>
      <MeasurementForm
        initial={latest}
        unitSystem={unitSystem}
        onUnitSystemChange={(u) => setProfile({ unitSystem: u })}
        onChange={setDraft}
      />

      <Text variant="heading" style={{ marginTop: t.space(4) }}>
        History
      </Text>
      {MEASUREMENT_TYPES.map((type) => {
        const history = historyFor(entries, type);
        if (history.length === 0) return null;
        return (
          <Card key={type}>
            <Text variant="heading">{MEASUREMENT_INFO[type].label}</Text>
            {history.map((entry, i) => {
              const older = history[i + 1];
              const delta = older
                ? toDisplay(type, entry.value, unitSystem) -
                  toDisplay(type, older.value, unitSystem)
                : 0;
              return (
                <View
                  key={entry.id}
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                  }}
                >
                  <Text tone="muted">
                    {new Date(entry.measuredAt).toLocaleDateString()}
                  </Text>
                  <Text>
                    {formatMeasurement(type, entry.value, unitSystem)}
                    {older && delta !== 0
                      ? `  ${delta > 0 ? "+" : "−"}${Math.abs(Math.round(delta * 10) / 10)} ${unitLabel(type, unitSystem)}`
                      : ""}
                  </Text>
                </View>
              );
            })}
          </Card>
        );
      })}
      {entries.length === 0 ? (
        <Text tone="muted">
          Save your first measurements to start tracking.
        </Text>
      ) : null}
    </Screen>
  );
}
