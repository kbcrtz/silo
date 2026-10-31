import { useEffect, useState } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { MISSING_SETTINGS, sleep, USE_MOCKS } from "@/api/config";
import { useMembership } from "@/api/purchases";
import { startSession } from "@/api/supabase";
import { useMeasurements } from "@/store/measurements";
import { useProfile } from "@/store/profile";
import { useSaved } from "@/store/saved";
import { useHydrated } from "@/store/storage";
import { useCloudSync } from "@/hooks/useCloudSync";
import { useAccount } from "@/store/account";
import { useTheme } from "@/theme";
import { BRAND, TYPE, useBrandFonts } from "@/theme/brand";

export default function RootLayout() {
  const hydrated = useHydrated([useProfile, useMeasurements, useSaved]);
  const [sessionReady, setSessionReady] = useState(false);
  useEffect(() => {
    // Offline or slow: start logged out after 8 s rather than hold the splash; the next launch retries.
    Promise.race([startSession().catch(() => {}), sleep(8000)]).then(() =>
      setSessionReady(true),
    );
  }, []);
  useCloudSync(hydrated && sessionReady);
  const onboarded = useProfile((s) => s.onboarded);
  const member = useAccount((s) => s.account.kind === "member");
  const lapsed = useMembership((s) => s.active === false);
  // Everyone signs in (mock mode has no accounts) and keeps a membership;
  // a lapsed one goes back to the paywall.
  const inApp = onboarded && (member || USE_MOCKS) && !lapsed;
  const fontsLoaded = useBrandFonts();
  const t = useTheme();

  if (MISSING_SETTINGS.length)
    return (
      <View style={{ flex: 1, justifyContent: "center", padding: 32, gap: 12 }}>
        <Text style={TYPE.control}>This build is missing its settings</Text>
        <Text style={[TYPE.bodySmall, { color: BRAND.inkSoft }]}>
          Set these as EAS environment variables and build again:{"\n"}
          {MISSING_SETTINGS.join("\n")}
        </Text>
      </View>
    );

  // Rendering before hydration would flash onboarding for returning users.
  if (!hydrated || !fontsLoaded || !sessionReady) return null;

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
        {/* Flipping `inApp` swaps which group exists; the router redirects on its own. */}
        <Stack.Protected guard={!inApp}>
          <Stack.Screen name="onboarding" />
        </Stack.Protected>
        <Stack.Protected guard={inApp}>
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
          {/* These draw their own glass back button over the season gradient. */}
          <Stack.Screen name="saved/index" />
          <Stack.Screen name="saved/[id]" />
          <Stack.Screen name="fit" />
          <Stack.Screen name="profile" />
          <Stack.Screen name="measurements" />
        </Stack.Protected>
      </Stack>
    </GestureHandlerRootView>
  );
}
