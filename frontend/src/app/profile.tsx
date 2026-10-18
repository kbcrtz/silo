import { Link } from "expo-router";
import { forgetDevice } from "@/api/userData";
import { useMemo } from "react";
import {
  Alert,
  Pressable,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Chip } from "@/components/Chip";
import { PassportCard } from "@/components/passport/PassportCard";
import { usePassportData } from "@/components/passport/usePassportData";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { loadDemoProfile } from "@/data/demo";
import { bodyShape } from "@/lib/bodyShape";
import type { FitPreference } from "@/lib/fit";
import {
  latestMeasurements,
  MEASUREMENT_INFO,
  MEASUREMENT_TYPES,
} from "@/lib/measurements";
import { formatMeasurement } from "@/lib/units";
import { useMeasurements } from "@/store/measurements";
import { useProfile } from "@/store/profile";
import { useSaved } from "@/store/saved";
import { useTheme } from "@/theme";

const FIT_PREFERENCES: FitPreference[] = ["slim", "regular", "relaxed"];

export default function Profile() {
  const t = useTheme();
  const profile = useProfile();
  const entries = useMeasurements((s) => s.entries);
  const latest = useMemo(() => latestMeasurements(entries), [entries]);
  const shape = bodyShape(latest);
  const season = t.season;
  const passport = usePassportData();
  const { width } = useWindowDimensions();

  const redoOnboarding = () =>
    Alert.alert("Redo onboarding?", "Your measurement history is kept.", [
      { text: "Cancel", style: "cancel" },
      { text: "Redo", onPress: () => profile.set({ onboarded: false }) },
    ]);

  const resetApp = () =>
    Alert.alert(
      "Reset Silo?",
      "Clears your profile, measurements and saved items.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: () => {
            // Offline: the phone still resets; the old backup stays until the server is reachable.
            forgetDevice().catch(() => {});
            useMeasurements.getState().replaceAll([]);
            useSaved.getState().clear();
            profile.reset();
          },
        },
      ],
    );

  return (
    <Screen edges={[]}>
      <Text variant="title">Profile</Text>

      {passport && season ? (
        <View style={{ gap: t.space(3), alignItems: "center" }}>
          <PassportCard data={passport} width={width - t.space(10)} />
          <Text variant="caption" tone="muted">
            Tilt to shimmer · Drag to turn · Tap to flip
          </Text>
        </View>
      ) : (
        <Card>
          <Text variant="caption" tone="muted">
            YOUR PASSPORT
          </Text>
          <Text tone="muted">
            Finish color analysis to get your Silo passport.
          </Text>
        </Card>
      )}

      {season && profile.colorProfile ? (
        <Card>
          <Text variant="caption" tone="muted">
            ON YOUR PASSPORT
          </Text>
          <TextInput
            value={profile.displayName ?? ""}
            onChangeText={(displayName) => profile.set({ displayName })}
            placeholder="Your name"
            placeholderTextColor={t.colors.textMuted}
            autoCapitalize="words"
            returnKeyType="done"
            maxLength={24}
            style={{
              ...t.type.body,
              color: t.colors.text,
              backgroundColor: t.colors.bg,
              borderColor: t.colors.border,
              borderWidth: 1,
              borderRadius: t.radius.sm,
              padding: t.space(3),
            }}
          />
        </Card>
      ) : null}

      <Link href="/measurements" asChild>
        <Pressable>
          <Card>
            <View
              style={{ flexDirection: "row", justifyContent: "space-between" }}
            >
              <Text variant="caption" tone="muted">
                MEASUREMENTS
              </Text>
              <Text variant="caption" tone="accent">
                Edit & history ›
              </Text>
            </View>
            {shape ? <Text variant="heading">{shape.name} shape</Text> : null}
            {MEASUREMENT_TYPES.filter((type) => latest[type] !== undefined).map(
              (type) => (
                <View
                  key={type}
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                  }}
                >
                  <Text tone="muted">{MEASUREMENT_INFO[type].label}</Text>
                  <Text>
                    {formatMeasurement(type, latest[type]!, profile.unitSystem)}
                  </Text>
                </View>
              ),
            )}
            {Object.keys(latest).length === 0 ? (
              <Text tone="muted">No measurements yet.</Text>
            ) : null}
          </Card>
        </Pressable>
      </Link>

      <Card>
        <Text variant="caption" tone="muted">
          FIT PREFERENCE
        </Text>
        <View style={{ flexDirection: "row", gap: t.space(2) }}>
          {FIT_PREFERENCES.map((p) => (
            <Chip
              key={p}
              label={p[0].toUpperCase() + p.slice(1)}
              selected={profile.fitPreference === p}
              onPress={() => profile.set({ fitPreference: p })}
            />
          ))}
        </View>
      </Card>

      <View style={{ gap: t.space(2), marginTop: t.space(2) }}>
        <Button
          variant="ghost"
          label="Redo onboarding"
          onPress={redoOnboarding}
        />
        <Button
          variant="ghost"
          label="Load demo profile"
          onPress={loadDemoProfile}
        />
        <Button variant="ghost" label="Reset app" onPress={resetApp} />
      </View>
    </Screen>
  );
}
