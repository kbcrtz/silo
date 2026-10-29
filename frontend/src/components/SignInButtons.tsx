import { Canvas, Group, Path } from "@shopify/react-native-skia";
import * as AppleAuthentication from "expo-apple-authentication";
import { SymbolView } from "expo-symbols";
import { useEffect, useState, type ReactNode } from "react";
import { ActivityIndicator, Alert, Pressable, Text, View } from "react-native";
import { signIn } from "@/api/auth";
import type { Provider } from "@/lib/account";

/** The onboarding call-to-action's size, so these sit in line with it. */
const HEIGHT = 57;
const RADIUS = 26;
const ICON = 20;
/** Where each logo sits, so the two line up when stacked. */
const ICON_INSET = 22;

/**
 * Brand colors, fixed by Apple's and Google's sign-in guidelines rather than
 * the season theme: black for Apple, Google's light button.
 */
const STYLES = {
  apple: { fill: "#000000", edge: "#000000", text: "#FFFFFF" },
  google: { fill: "#FFFFFF", edge: "#747775", text: "#1F1F1F" },
} as const;

/** Google's four-color "G", from its 48pt sign-in asset. */
const G_PATHS = [
  {
    color: "#EA4335",
    d: "M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z",
  },
  {
    color: "#4285F4",
    d: "M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z",
  },
  {
    color: "#FBBC05",
    d: "M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z",
  },
  {
    color: "#34A853",
    d: "M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z",
  },
];

function GoogleLogo() {
  return (
    <Canvas style={{ width: ICON, height: ICON }}>
      <Group transform={[{ scale: ICON / 48 }]}>
        {G_PATHS.map((p) => (
          <Path key={p.color} path={p.d} color={p.color} />
        ))}
      </Group>
    </Canvas>
  );
}

function AppleLogo() {
  return (
    <SymbolView
      name="apple.logo"
      size={ICON}
      weight="medium"
      tintColor={STYLES.apple.text}
      style={{ width: ICON, height: ICON }}
    />
  );
}

/**
 * One provider button. The logo sits at a fixed inset on the left and the
 * label is centered on the whole button, so stacked buttons share both
 * lines. A spinner takes the logo's place while signing in.
 */
function ProviderButton({
  provider,
  label,
  logo,
  busy,
  dimmed,
  onPress,
}: {
  provider: Provider;
  label: string;
  logo: ReactNode;
  busy: boolean;
  dimmed: boolean;
  onPress: () => void;
}) {
  const s = STYLES[provider];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ busy, disabled: dimmed }}
      onPress={onPress}
      style={({ pressed }) => ({
        height: HEIGHT,
        borderRadius: RADIUS,
        borderWidth: 1,
        borderColor: s.edge,
        backgroundColor: s.fill,
        alignItems: "center",
        justifyContent: "center",
        opacity: dimmed ? 0.5 : pressed ? 0.85 : 1,
      })}
    >
      <View
        style={{
          position: "absolute",
          left: ICON_INSET,
          width: ICON,
          height: ICON,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {busy ? <ActivityIndicator color={s.text} /> : logo}
      </View>
      {/* The system font, as Apple's sign-in guidelines ask; both share it. */}
      <Text
        style={{
          color: s.text,
          fontSize: 17,
          fontWeight: "600",
          letterSpacing: -0.2,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * "Continue with Apple" and "Continue with Google". `onSignedIn` runs once
 * the account is connected; a cancelled sheet does nothing, a failure alerts.
 */
export function SignInButtons({ onSignedIn }: { onSignedIn: () => void }) {
  const [apple, setApple] = useState(false);
  const [busy, setBusy] = useState<Provider | null>(null);

  useEffect(() => {
    AppleAuthentication.isAvailableAsync().then(setApple, () => {});
  }, []);

  const run = async (provider: Provider) => {
    if (busy) return;
    setBusy(provider);
    try {
      if (await signIn(provider)) onSignedIn();
    } catch (e) {
      Alert.alert(
        "Couldn't sign in",
        e instanceof Error ? e.message : "Please try again.",
      );
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={{ gap: 12 }} pointerEvents={busy ? "none" : "auto"}>
      {apple ? (
        <ProviderButton
          provider="apple"
          label="Continue with Apple"
          logo={<AppleLogo />}
          busy={busy === "apple"}
          dimmed={busy === "google"}
          onPress={() => run("apple")}
        />
      ) : null}
      <ProviderButton
        provider="google"
        label="Continue with Google"
        logo={<GoogleLogo />}
        busy={busy === "google"}
        dimmed={busy === "apple"}
        onPress={() => run("google")}
      />
    </View>
  );
}
