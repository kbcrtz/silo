import { router } from "expo-router";
import { SymbolView } from "expo-symbols";
import { Pressable, Text, View } from "react-native";
import { Glass } from "@/components/onboarding/Glass";
import { useProfile } from "@/store/profile";
import { BRAND, TYPE } from "@/theme/brand";

/**
 * A one-time card on the feed for shoppers who never picked a style: those
 * who onboarded before the style step, or skipped it. Gone once they pick
 * one or close it.
 */
export function StylePrompt() {
  const taste = useProfile((s) => s.taste);
  const set = useProfile((s) => s.set);
  if (taste?.stated || taste?.promptDismissedAt) return null;

  return (
    <Glass
      radius={22}
      fill="rgba(255,255,255,0.5)"
      edge="rgba(255,255,255,0.8)"
      style={{ marginTop: 18, padding: 16, gap: 12 }}
    >
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={TYPE.question}>Tell us your style</Text>
          <Text style={[TYPE.bodySmall, { color: BRAND.inkSoft }]}>
            Pick the looks you’d wear, and your feed searches for them in your
            colors.
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Not now"
          hitSlop={10}
          onPress={() =>
            set({
              taste: { ...taste, promptDismissedAt: new Date().toISOString() },
            })
          }
        >
          <SymbolView
            name="xmark"
            size={14}
            tintColor={BRAND.inkSoft}
            style={{ width: 16, height: 16 }}
          />
        </Pressable>
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push("/style")}
        style={{ alignSelf: "flex-start" }}
      >
        <Glass
          radius={18}
          fill={BRAND.ink}
          solid
          edge={BRAND.ink}
          style={{ height: 36, paddingHorizontal: 16, justifyContent: "center" }}
        >
          <Text style={[TYPE.button, { color: BRAND.white }]}>
            Pick my style
          </Text>
        </Glass>
      </Pressable>
    </Glass>
  );
}
