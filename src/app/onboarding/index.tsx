import { router } from "expo-router";
import { View } from "react-native";
import { Button } from "@/components/Button";
import { Screen } from "@/components/Screen";
import { Swatches } from "@/components/Swatches";
import { Text } from "@/components/Text";
import { loadDemoProfile } from "@/data/demo";
import { SEASONS } from "@/data/seasons";
import { useTheme } from "@/theme";

const PREVIEW = [
  SEASONS["light-spring"].signature,
  SEASONS["true-summer"].signature,
  SEASONS["soft-autumn"].signature,
  SEASONS["deep-winter"].signature,
  SEASONS["bright-spring"].signature,
];

export default function Welcome() {
  const t = useTheme();
  return (
    <Screen
      scroll={false}
      contentStyle={{ justifyContent: "center" }}
      footer={
        <View style={{ gap: t.space(2), paddingBottom: t.space(2) }}>
          <Button
            label="Get started"
            onPress={() => router.push("/onboarding/shop-for")}
          />
          <Button
            variant="ghost"
            label="Use demo profile"
            onPress={loadDemoProfile}
          />
        </View>
      }
    >
      <Swatches colors={PREVIEW} size={44} animated />
      <Text variant="display">Silo</Text>
      <Text variant="heading" tone="muted">
        Find your colors, know your fit, and see yourself in it before you buy.
      </Text>
    </Screen>
  );
}
