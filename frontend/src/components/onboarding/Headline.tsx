import { Fragment } from "react";
import { Text, View, type TextStyle } from "react-native";
import { FONTS, TYPE } from "@/theme/brand";

/**
 * The eyebrow and serif title that open each step. Words wrapped in *stars*
 * are set in italic, and \n breaks the line where the design does:
 * "Tell us a little\nabout *you.*"
 */
export function Headline({
  eyebrow,
  title,
  size = "large",
  gap = 2,
}: {
  eyebrow: string;
  title: string;
  size?: "large" | "medium";
  gap?: number;
}) {
  const style = size === "large" ? TYPE.title : TYPE.titleMedium;
  return (
    <View style={{ gap }}>
      <Text style={TYPE.eyebrow}>{eyebrow.toUpperCase()}</Text>
      <Text style={style} accessibilityRole="header">
        {renderEmphasis(title, style)}
      </Text>
    </View>
  );
}

export function renderEmphasis(text: string, style: TextStyle) {
  return text.split("*").map((part, i) =>
    i % 2 ? (
      <Text
        key={i}
        style={{
          fontFamily: FONTS.serifItalic,
          letterSpacing: style.letterSpacing,
        }}
      >
        {part}
      </Text>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  );
}
