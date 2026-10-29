import { useRef, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import {
  isPlausible,
  MEASUREMENT_INFO,
  MEASUREMENT_TYPES,
  type Measurements,
  type MeasurementType,
} from "@/lib/measurements";
import {
  rangeHint,
  fromDisplay,
  toDisplay,
  unitLabel,
  type UnitSystem,
} from "@/lib/units";
import { useTheme } from "@/theme";
import { BRAND, TYPE } from "@/theme/brand";
import { GlassSection, GlassSegmented } from "./GlassList";

type Props = {
  initial: Measurements;
  unitSystem: UnitSystem;
  onUnitSystemChange: (system: UnitSystem) => void;
  /** Called on every edit with values in cm / kg. */
  onChange: (values: Measurements) => void;
};

const UNITS: { id: UnitSystem; label: string }[] = [
  { id: "imperial", label: "in / lb" },
  { id: "metric", label: "cm / kg" },
];

/**
 * One glass row per measurement, with how to measure it underneath (or the
 * plausible range, when what's typed is out of it). Inputs hold display-unit strings; switching units converts what is typed
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
  const inputs = useRef<Partial<Record<MeasurementType, TextInput | null>>>({});

  const edit = (type: MeasurementType, raw: string) => {
    setText((prev) => ({ ...prev, [type]: raw }));
    const n = parseFloat(raw.replace(",", "."));
    const next = { ...values };
    const cm =
      Number.isFinite(n) && n > 0 ? fromDisplay(type, n, unitSystem) : NaN;
    // Out-of-range numbers are shown as a hint, never saved.
    if (isPlausible(type, cm)) next[type] = cm;
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
    <View style={{ gap: 20 }}>
      <GlassSegmented
        options={UNITS}
        value={unitSystem}
        onChange={switchUnits}
      />
      <GlassSection title="Your measurements">
        {MEASUREMENT_TYPES.map((type) => {
          const info = MEASUREMENT_INFO[type];
          const invalid = !!text[type] && values[type] === undefined;
          return (
            <Pressable
              key={type}
              onPress={() => inputs.current[type]?.focus()}
              style={{
                paddingHorizontal: 18,
                paddingVertical: 12,
                flexDirection: "row",
                alignItems: "center",
                gap: 14,
              }}
            >
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={TYPE.control}>{info.label}</Text>
                <Text
                  style={[
                    TYPE.bodySmall,
                    { color: invalid ? t.colors.danger : BRAND.inkSoft },
                  ]}
                >
                  {invalid ? rangeHint(type, unitSystem) : info.howTo}
                </Text>
              </View>
              <View
                style={{
                  width: 104,
                  height: 40,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: invalid ? t.colors.danger : BRAND.outlineSoft,
                  backgroundColor: BRAND.glassFillStrong,
                  flexDirection: "row",
                  alignItems: "center",
                  paddingHorizontal: 12,
                  gap: 6,
                }}
              >
                <TextInput
                  ref={(r) => {
                    inputs.current[type] = r;
                  }}
                  value={text[type] ?? ""}
                  onChangeText={(raw) => edit(type, raw)}
                  keyboardType="decimal-pad"
                  placeholder={
                    type === "height" && unitSystem === "imperial" ? "67" : "—"
                  }
                  placeholderTextColor={BRAND.placeholder}
                  selectionColor={BRAND.ink}
                  maxFontSizeMultiplier={1.3}
                  accessibilityLabel={`${info.label} in ${unitLabel(type, unitSystem)}`}
                  style={[
                    TYPE.control,
                    { flex: 1, textAlign: "right", paddingVertical: 0 },
                  ]}
                />
                <Text style={[TYPE.caption, { color: BRAND.inkSoft }]}>
                  {unitLabel(type, unitSystem)}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </GlassSection>
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
