import { router } from "expo-router";
import { SymbolView } from "expo-symbols";
import { Pressable, Text, View } from "react-native";
import { BRAND, TYPE } from "@/theme/brand";

/**
 * The row at the top of each step: a back arrow (or the wordmark once there
 * is nothing to go back to) and a pill with the step or section.
 */
export function Header({
  badge,
  wordmark,
  onBack = () => router.back(),
}: {
  badge: string;
  wordmark?: boolean;
  onBack?: () => void;
}) {
  return (
    <View
      style={{
        height: 28,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      {wordmark ? (
        <Text style={TYPE.wordmark}>Silo</Text>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={14}
          onPress={onBack}
          style={{ marginLeft: 4 }}
        >
          <SymbolView
            name="arrow.left"
            size={21}
            weight="light"
            tintColor={BRAND.inkSoft}
            style={{ width: 22, height: 22 }}
          />
        </Pressable>
      )}
      <View
        style={{
          height: 28,
          paddingHorizontal: 13,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: BRAND.inkFaint,
          justifyContent: "center",
        }}
      >
        <Text style={TYPE.badge}>{badge}</Text>
      </View>
    </View>
  );
}

/** "01 / 04" */
export const stepBadge = (step: number, of = 4) =>
  `${String(step).padStart(2, "0")} / ${String(of).padStart(2, "0")}`;
