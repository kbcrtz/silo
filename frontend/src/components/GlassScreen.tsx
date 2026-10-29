import type { ReactNode } from "react";
import { KeyboardAvoidingView, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Backdrop, useSeasonBackdrop } from "./onboarding/Backdrop";
import { Header } from "./onboarding/Header";
import { Headline } from "./onboarding/Headline";
import { GUTTER } from "./onboarding/OnboardingScreen";

/**
 * A pushed screen in the app's look: the season gradient, the glass back
 * button and badge, a serif headline, then content. A `footer` stays pinned
 * below the scrolling content, for the screen's main action.
 */
export function GlassScreen({
  badge,
  eyebrow,
  title,
  footer,
  children,
}: {
  badge: string;
  eyebrow: string;
  /** As in Headline: *stars* set italic, \n breaks the line. */
  title: string;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const backdrop = useSeasonBackdrop();
  return (
    <View style={{ flex: 1 }}>
      <Backdrop id={backdrop} />
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingTop: insets.top + 8,
            paddingHorizontal: GUTTER,
            paddingBottom: footer ? 24 : insets.bottom + 32,
            gap: 28,
          }}
        >
          <View style={{ gap: 20 }}>
            <Header badge={badge} />
            <Headline size="medium" eyebrow={eyebrow} title={title} />
          </View>
          {children}
        </ScrollView>
        {footer ? (
          <View
            style={{
              paddingHorizontal: GUTTER,
              paddingTop: 12,
              paddingBottom: Math.max(insets.bottom, 16) + 8,
            }}
          >
            {footer}
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </View>
  );
}
