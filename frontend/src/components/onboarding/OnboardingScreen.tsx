import type { ReactNode } from "react";
import {
  KeyboardAvoidingView,
  ScrollView,
  View,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { BackdropId } from "@/theme/backdrops";
import { Backdrop } from "./Backdrop";

/** Side margin of every onboarding frame. */
export const GUTTER = 24;
/** Where the header sits; the status bar is hidden during onboarding. */
const TOP = 30;

/**
 * An onboarding step: the gradient behind, content scrolling over it with
 * the design's margins. Buttons live in the flow, as in the frames, so a
 * keyboard pushes the content up rather than covering it.
 */
export function OnboardingScreen({
  backdrop = "neutral",
  children,
  contentStyle,
}: {
  backdrop?: BackdropId;
  children: ReactNode;
  contentStyle?: ViewStyle;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1 }}>
      <Backdrop id={backdrop} />
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            {
              flexGrow: 1,
              paddingHorizontal: GUTTER,
              paddingTop: TOP,
              paddingBottom: Math.max(insets.bottom, 16) + 16,
            },
            contentStyle,
          ]}
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
