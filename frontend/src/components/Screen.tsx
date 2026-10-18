import type { ReactNode } from "react";
import {
  ScrollView,
  View,
  type ScrollViewProps,
  type ViewStyle,
} from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";
import { useTheme } from "@/theme";

type Props = {
  children: ReactNode;
  scroll?: boolean;
  /** Pinned below the content, e.g. a primary button. */
  footer?: ReactNode;
  edges?: Edge[];
  contentStyle?: ViewStyle;
  /** Extra ScrollView props, e.g. pull-to-refresh or infinite scroll. */
  scrollProps?: ScrollViewProps;
};

export function Screen({
  children,
  scroll = true,
  footer,
  edges = ["top"],
  contentStyle,
  scrollProps,
}: Props) {
  const t = useTheme();
  const padding = {
    paddingHorizontal: t.space(5),
    paddingVertical: t.space(4),
    gap: t.space(4),
  };
  return (
    <SafeAreaView
      edges={edges}
      style={{ flex: 1, backgroundColor: t.colors.bg }}
    >
      {scroll ? (
        <ScrollView
          {...scrollProps}
          contentContainerStyle={[padding, contentStyle]}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, padding, contentStyle]}>{children}</View>
      )}
      {footer ? (
        <SafeAreaView
          edges={["bottom"]}
          style={{ paddingHorizontal: t.space(5), paddingTop: t.space(2) }}
        >
          {footer}
        </SafeAreaView>
      ) : null}
    </SafeAreaView>
  );
}
