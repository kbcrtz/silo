import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { useMemo, useRef, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { PrimaryButton } from "@/components/onboarding/Buttons";
import { BodySilhouette } from "@/components/onboarding/BodySilhouette";
import { Glass } from "@/components/onboarding/Glass";
import { Header } from "@/components/onboarding/Header";
import { Headline } from "@/components/onboarding/Headline";
import { OnboardingScreen } from "@/components/onboarding/OnboardingScreen";
import { familyOf } from "@/data/families";
import {
  isPlausible,
  latestMeasurements,
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
import { useMeasurements } from "@/store/measurements";
import { useProfile } from "@/store/profile";
import { BRAND, TYPE } from "@/theme/brand";

const FIELDS: { type: MeasurementType; label: string; hint: string }[] = [
  { type: "height", label: "Height", hint: "Head to floor" },
  { type: "weight", label: "Weight", hint: "Current body weight" },
  { type: "armLength", label: "Arm length", hint: "Shoulder to wrist" },
  { type: "inseam", label: "Leg length", hint: "Crotch to floor" },
  { type: "hips", label: "Hips", hint: "Fullest point" },
  { type: "waist", label: "Waist", hint: "Natural waistline" },
  { type: "chest", label: "Chest", hint: "Around upper torso" },
  { type: "bust", label: "Bust", hint: "Fullest point" },
];

const texts = (m: Measurements, system: UnitSystem) =>
  Object.fromEntries(
    FIELDS.map(({ type }) => [
      type,
      m[type] === undefined ? "" : String(toDisplay(type, m[type]!, system)),
    ]),
  ) as Record<MeasurementType, string>;

function UnitToggle({
  value,
  onChange,
}: {
  value: UnitSystem;
  onChange: (u: UnitSystem) => void;
}) {
  return (
    <Glass
      radius={21.5}
      variant="clear"
      fill="rgba(23,19,17,0.08)"
      edge="rgba(255,255,255,0.25)"
      style={{
        height: 43,
        flexDirection: "row",
        alignItems: "center",
        padding: 4,
      }}
    >
      {(["metric", "imperial"] as const).map((u) => (
        <Pressable
          key={u}
          accessibilityRole="radio"
          accessibilityState={{ selected: value === u }}
          onPress={() => {
            Haptics.selectionAsync();
            onChange(u);
          }}
          style={{
            height: 35,
            paddingHorizontal: 14,
            borderRadius: 17.5,
            justifyContent: "center",
            backgroundColor: value === u ? "#000000" : "transparent",
          }}
        >
          <Text
            style={[
              TYPE.control,
              {
                fontSize: 15.5,
                color: value === u ? BRAND.white : BRAND.inkSoft,
              },
            ]}
          >
            {u.toUpperCase()}
          </Text>
        </Pressable>
      ))}
    </Glass>
  );
}

function MeasureCard({
  label,
  hint,
  unit,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  unit: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const input = useRef<TextInput>(null);
  return (
    <Pressable
      onPress={() => input.current?.focus()}
      style={{ width: "48.3%" }}
    >
      <Glass
        radius={21}
        fill="rgba(255,255,255,0.4)"
        style={{ minHeight: 96, paddingHorizontal: 13, paddingTop: 15 }}
      >
        <Text style={TYPE.fieldLabel}>{label}</Text>
        <Text style={[TYPE.fieldHint, { color: BRAND.inkMuted, marginTop: 5 }]}>
          {hint}
        </Text>
        <View
          style={{
            flexDirection: "row",
            alignItems: "flex-end",
            marginTop: "auto",
            paddingBottom: 14,
          }}
        >
          <TextInput
            ref={input}
            value={value}
            onChangeText={onChange}
            placeholder="—"
            placeholderTextColor="rgba(23,19,17,0.25)"
            keyboardType="decimal-pad"
            maxLength={5}
            accessibilityLabel={label}
            style={[TYPE.control, { flex: 1, padding: 0 }]}
          />
          <Text
            style={[TYPE.fieldUnit, { color: BRAND.inkMuted, marginBottom: 2 }]}
          >
            {unit.toUpperCase()}
          </Text>
        </View>
      </Glass>
    </Pressable>
  );
}

/**
 * The last design step: measurements, with the silhouette redrawing to
 * them as they're typed. Everything is optional; the mannequin fills gaps
 * from an average figure scaled to the height.
 */
export default function BodyProfile() {
  const entries = useMeasurements((s) => s.entries);
  const latest = useMemo(() => latestMeasurements(entries), [entries]);
  const shopFor = useProfile((s) => s.shopFor);
  const seasonId = useProfile((s) => s.colorProfile?.seasonId);
  const unitSystem = useProfile((s) => s.unitSystem);
  const set = useProfile((s) => s.set);
  const [values, setValues] = useState<Measurements>(latest);
  const [text, setText] = useState(() => texts(latest, unitSystem));

  const edit = (type: MeasurementType, raw: string) => {
    setText((t) => ({ ...t, [type]: raw }));
    const n = parseFloat(raw.replace(",", "."));
    setValues((v) => {
      const next = { ...v };
      const cm =
        Number.isFinite(n) && n > 0 ? fromDisplay(type, n, unitSystem) : NaN;
      // Out-of-range numbers (feet in an inches box) are shown as a hint, never saved or drawn.
      if (isPlausible(type, cm)) next[type] = cm;
      else delete next[type];
      return next;
    });
  };

  const switchUnits = (u: UnitSystem) => {
    if (u === unitSystem) return;
    setText(texts(values, u));
    set({ unitSystem: u });
  };

  const create = () => {
    useMeasurements.getState().record(values, latest);
    router.push("/onboarding/passport");
  };

  return (
    <OnboardingScreen backdrop={seasonId ? familyOf(seasonId) : "neutral"}>
      <Header wordmark badge="BODY PROFILE" />
      <View style={{ marginTop: 26 }}>
        <Headline
          size="medium"
          eyebrow="Your proportions"
          title={"Build your\n*silhouette.*"}
        />
        <View style={{ position: "absolute", right: 0, bottom: 2 }}>
          <UnitToggle value={unitSystem} onChange={switchUnits} />
        </View>
      </View>
      <Text style={[TYPE.bodySmall, { color: BRAND.inkSoft, marginTop: 20 }]}>
        Add your measurements and watch the silhouette adjust to your
        proportions in real time.
      </Text>

      <Glass
        radius={37}
        fill="rgba(255,255,255,0.45)"
        style={{
          height: 241,
          marginTop: 25,
          alignItems: "center",
          justifyContent: "flex-end",
          paddingBottom: 17,
        }}
      >
        <BodySilhouette measurements={values} shopFor={shopFor} height={200} />
      </Glass>

      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          justifyContent: "space-between",
          rowGap: 12,
          marginTop: 20,
        }}
      >
        {FIELDS.map((f) => (
          <MeasureCard
            key={f.type}
            label={f.label}
            hint={
              text[f.type] && values[f.type] === undefined
                ? rangeHint(f.type, unitSystem)
                : f.hint
            }
            unit={unitLabel(f.type, unitSystem)}
            value={text[f.type]}
            onChange={(v) => edit(f.type, v)}
          />
        ))}
      </View>

      <PrimaryButton
        label="Create my body profile"
        onPress={create}
        style={{ marginTop: 20 }}
      />
      <Text
        style={[
          TYPE.footnote,
          { color: BRAND.inkMuted, textAlign: "center", marginTop: 16 },
        ]}
      >
        {"Saved on this device and backed up to Silo's server. "}
        Your selfie stays on your phone.
      </Text>
    </OnboardingScreen>
  );
}
