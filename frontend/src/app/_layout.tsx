import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useMeasurements } from "@/store/measurements";
import { useProfile } from "@/store/profile";
import { useSaved } from "@/store/saved";
import { useHydrated } from "@/store/storage";
import { useCloudSync } from "@/hooks/useCloudSync";
import { useTheme } from "@/theme";
import { BRAND, useBrandFonts } from "@/theme/brand";

/** Pushed screens show only the back button; they title themselves. */
const pushed = { headerShown: true, title: "" };

export default function RootLayout() {
  const hydrated = useHydrated([useProfile, useMeasurements, useSaved]);
  useCloudSync(hydrated);
  const onboarded = useProfile((s) => s.onboarded);
  const fontsLoaded = useBrandFonts();
  const t = useTheme();

  // Rendering before hydration would flash onboarding for returning users.
  if (!hydrated || !fontsLoaded) return null;

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
          {/* One home screen; everything else opens from its top bar. */}
          <Stack.Screen name="index" />
          <Stack.Screen
            name="item/[id]"
            options={{
              presentation: "formSheet",
              sheetAllowedDetents: [0.78, 1],
              sheetGrabberVisible: true,
              sheetCornerRadius: 28,
              contentStyle: { backgroundColor: BRAND.white },
            }}
          />
          <Stack.Screen name="saved/index" options={pushed} />
          <Stack.Screen name="saved/[id]" options={pushed} />
          <Stack.Screen name="profile" options={pushed} />
          <Stack.Screen
            name="measurements"
            options={{ headerShown: true, title: "Measurements" }}
          />
        </Stack.Protected>
      </Stack>
    </GestureHandlerRootView>
  );
}
