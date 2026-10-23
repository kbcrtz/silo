import * as AppleAuthentication from "expo-apple-authentication";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, Text, View } from "react-native";
import { signIn } from "@/api/auth";
import type { Provider } from "@/lib/account";
import { BRAND, TYPE } from "@/theme/brand";

/** The onboarding call-to-action's size, so these sit in line with it. */
const HEIGHT = 57;
const RADIUS = 26;

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
        <View style={{ height: HEIGHT, opacity: busy === "google" ? 0.5 : 1 }}>
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={
              AppleAuthentication.AppleAuthenticationButtonType.CONTINUE
            }
            buttonStyle={
              AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
            }
            cornerRadius={RADIUS}
            onPress={() => run("apple")}
            style={{ width: "100%", height: HEIGHT }}
          />
          {busy === "apple" ? (
            <ActivityIndicator
              color={BRAND.white}
              style={{ position: "absolute", right: 23, top: 0, bottom: 0 }}
            />
          ) : null}
        </View>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ busy: busy === "google" }}
        onPress={() => run("google")}
        style={({ pressed }) => ({
          height: HEIGHT,
          borderRadius: RADIUS,
          borderWidth: 1,
          borderColor: BRAND.outlineSoft,
          backgroundColor: BRAND.white,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          opacity: busy === "apple" ? 0.5 : pressed ? 0.85 : 1,
        })}
      >
        <Text style={[TYPE.button, { color: BRAND.ink, fontSize: 17 }]}>
          Continue with Google
        </Text>
        {busy === "google" ? <ActivityIndicator color={BRAND.ink} /> : null}
      </Pressable>
    </View>
  );
}
