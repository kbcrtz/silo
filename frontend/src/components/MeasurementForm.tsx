import { useState } from "react";
import { TextInput, View } from "react-native";
import {
  MEASUREMENT_INFO,
  MEASUREMENT_TYPES,
  type Measurements,
  type MeasurementType,
} from "@/lib/measurements";
import {
  fromDisplay,
  toDisplay,
  unitLabel,
  type UnitSystem,
} from "@/lib/units";
import { useTheme } from "@/theme";
import { Chip } from "./Chip";
import { Text } from "./Text";

type Props = {
  initial: Measurements;
  unitSystem: UnitSystem;
  onUnitSystemChange: (system: UnitSystem) => void;
  /** Called on every edit with values in cm / kg. */
  onChange: (values: Measurements) => void;
};

/**
 * Inputs hold display-unit strings; switching units converts what is typed
 * through the stored-unit values so nothing drifts or gets lost.
 */
export function MeasurementForm({
  initial,
  unitSystem,
  onUnitSystemChange,
  onChange,
}: Props) {
  const t = useTheme();
  const [values, setValues] = useState<Measurements>(initial);
  const [text, setText] = useState(() => toTexts(initial, unitSystem));

  const edit = (type: MeasurementType, raw: string) => {
    setText((prev) => ({ ...prev, [type]: raw }));
    const n = parseFloat(raw.replace(",", "."));
    const next = { ...values };
    if (Number.isFinite(n) && n > 0)
      next[type] = fromDisplay(type, n, unitSystem);
    else delete next[type];
    setValues(next);
    onChange(next);
  };

  const switchUnits = (system: UnitSystem) => {
    if (system === unitSystem) return;
    setText(toTexts(values, system));
    onUnitSystemChange(system);
  };

  return (
    <View style={{ gap: t.space(4) }}>
      <View style={{ flexDirection: "row", gap: t.space(2) }}>
        <Chip
          label="in / lb"
          selected={unitSystem === "imperial"}
          onPress={() => switchUnits("imperial")}
        />
        <Chip
          label="cm / kg"
          selected={unitSystem === "metric"}
          onPress={() => switchUnits("metric")}
        />
      </View>
      {MEASUREMENT_TYPES.map((type) => {
        const info = MEASUREMENT_INFO[type];
        const label = info.label;
        return (
          <View key={type} style={{ gap: t.space(1) }}>
            <View
              style={{ flexDirection: "row", justifyContent: "space-between" }}
            >
              <Text variant="heading">{label}</Text>
              <Text tone="muted">{unitLabel(type, unitSystem)}</Text>
            </View>
            <TextInput
              value={text[type] ?? ""}
              onChangeText={(raw) => edit(type, raw)}
              keyboardType="decimal-pad"
              placeholder={
                type === "height" && unitSystem === "imperial"
                  ? "Total inches, e.g. 67"
                  : "—"
              }
              placeholderTextColor={t.colors.textMuted}
              style={{
                ...t.type.body,
                color: t.colors.text,
                backgroundColor: t.colors.surface,
                borderColor: t.colors.border,
                borderWidth: 1,
                borderRadius: t.radius.sm,
                padding: t.space(3),
              }}
            />
            <Text variant="caption" tone="muted">
              {info.howTo}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function toTexts(
  values: Measurements,
  system: UnitSystem,
): Partial<Record<MeasurementType, string>> {
  const out: Partial<Record<MeasurementType, string>> = {};
  for (const type of MEASUREMENT_TYPES) {
    const v = values[type];
    if (v !== undefined) out[type] = String(toDisplay(type, v, system));
  }
  return out;
}
