import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { BRAND } from "@/theme/brand";

/** The status bar is hidden so each step lays out like its design frame. */
export default function OnboardingLayout() {
  return (
    <>
      <StatusBar hidden />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: BRAND.paper },
        }}
      />
    </>
  );
}
