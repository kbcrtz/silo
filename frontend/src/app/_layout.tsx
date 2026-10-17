import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useMeasurements } from "@/store/measurements";
import { useProfile } from "@/store/profile";
import { useHydrated } from "@/store/storage";
import { usePollPendingJobs, useTryOn } from "@/store/tryOn";
import { useTheme } from "@/theme";

export default function RootLayout() {
  const hydrated = useHydrated([useProfile, useMeasurements, useTryOn]);
  const onboarded = useProfile((s) => s.onboarded);
  const t = useTheme();
  usePollPendingJobs();

  // Rendering before hydration would flash onboarding for returning users.
  if (!hydrated) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: t.colors.bg }}>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: t.colors.bg },
          headerTintColor: t.colors.accentText,
          headerStyle: { backgroundColor: t.colors.bg },
          headerShadowVisible: false,
          headerBackButtonDisplayMode: "minimal",
        }}
      >
        {/* Flipping `onboarded` swaps which group exists; the router redirects on its own. */}
        <Stack.Protected guard={!onboarded}>
          <Stack.Screen name="onboarding" />
        </Stack.Protected>
        <Stack.Protected guard={onboarded}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="item/[id]"
            options={{ headerShown: true, title: "" }}
          />
          <Stack.Screen
            name="measurements"
            options={{ headerShown: true, title: "Measurements" }}
          />
          <Stack.Screen
            name="result/[id]"
            options={{ presentation: "fullScreenModal" }}
          />
        </Stack.Protected>
      </Stack>
    </GestureHandlerRootView>
  );
}
