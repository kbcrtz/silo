import { router } from "expo-router";
import { SymbolView } from "expo-symbols";
import { Pressable, Text, View } from "react-native";
import { BRAND, TYPE } from "@/theme/brand";
import { Glass } from "./Glass";

/** The back button's glass circle. */
const BACK = 40;
const FILL = "rgba(255,255,255,0.42)";
const EDGE = "rgba(255,255,255,0.75)";

/**
 * The row at the top of each step: a glass back button (or the wordmark once
 * there is nothing to go back to) and a glass pill with the step or section.
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
          hitSlop={8}
          onPress={onBack}
          // Taller than the row; the negative margin keeps the row at 28.
          style={{ marginVertical: -(BACK - 28) / 2 }}
        >
          <Glass
            radius={BACK / 2}
            fill={FILL}
            edge={EDGE}
            interactive
            style={{
              width: BACK,
              height: BACK,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <SymbolView
              name="arrow.left"
              size={18}
              weight="regular"
              tintColor={BRAND.ink}
              style={{ width: 20, height: 20 }}
            />
          </Glass>
        </Pressable>
      )}
      <Glass
        radius={14}
        fill={FILL}
        edge={EDGE}
        style={{ height: 28, paddingHorizontal: 13, justifyContent: "center" }}
      >
        <Text style={TYPE.badge}>{badge}</Text>
      </Glass>
    </View>
  );
}

/** "01 / 04" */
export const stepBadge = (step: number, of = 4) =>
  `${String(step).padStart(2, "0")} / ${String(of).padStart(2, "0")}`;
