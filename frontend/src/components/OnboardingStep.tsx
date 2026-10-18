import type { ReactNode } from "react";
import { View } from "react-native";
import { useTheme } from "@/theme";
import { Button } from "./Button";
import { Screen } from "./Screen";
import { Text } from "./Text";

export const ONBOARDING_STEPS = [
  "shop-for",
  "selfie",
  "quiz",
  "season",
  "measurements",
  "body-shape",
  "passport",
] as const;

type Props = {
  step: (typeof ONBOARDING_STEPS)[number];
  title: string;
  subtitle?: string;
  children?: ReactNode;
  primary?: {
    label: string;
    onPress: () => void;
    disabled?: boolean;
    loading?: boolean;
  };
  secondary?: { label: string; onPress: () => void };
};

export function OnboardingStep({
  step,
  title,
  subtitle,
  children,
  primary,
  secondary,
}: Props) {
  const t = useTheme();
  const index = ONBOARDING_STEPS.indexOf(step);
  return (
    <Screen
      edges={["top"]}
      footer={
        primary || secondary ? (
          <View style={{ gap: t.space(2), paddingBottom: t.space(2) }}>
            {primary ? <Button {...primary} /> : null}
            {secondary ? <Button variant="ghost" {...secondary} /> : null}
          </View>
        ) : undefined
      }
    >
      <View style={{ flexDirection: "row", gap: t.space(1) }}>
        {ONBOARDING_STEPS.map((s, i) => (
          <View
            key={s}
            style={{
              flex: 1,
              height: 4,
              borderRadius: 2,
              backgroundColor: i <= index ? t.colors.accent : t.colors.border,
            }}
          />
        ))}
      </View>
      <View style={{ gap: t.space(2), marginTop: t.space(2) }}>
        <Text variant="title">{title}</Text>
        {subtitle ? <Text tone="muted">{subtitle}</Text> : null}
      </View>
      {children}
    </Screen>
  );
}
