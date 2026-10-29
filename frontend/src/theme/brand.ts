import { DMSans_400Regular } from "@expo-google-fonts/dm-sans/400Regular";
import { DMSans_500Medium } from "@expo-google-fonts/dm-sans/500Medium";
import { InstrumentSerif_400Regular } from "@expo-google-fonts/instrument-serif/400Regular";
import { InstrumentSerif_400Regular_Italic } from "@expo-google-fonts/instrument-serif/400Regular_Italic";
import { useFonts } from "expo-font";
import type { TextStyle } from "react-native";

/**
 * Silo's brand layer: the type and fixed colors of onboarding, which happens
 * before there is a season to theme from. Sizes are taken from the design
 * frames (402pt wide), so screens match them point for point.
 */
export const FONTS = {
  serif: "InstrumentSerif_400Regular",
  serifItalic: "InstrumentSerif_400Regular_Italic",
  sans: "DMSans_400Regular",
  sansMedium: "DMSans_500Medium",
};

/** Loads the brand fonts; true once they can be used. */
export function useBrandFonts(): boolean {
  const [loaded, error] = useFonts({
    [FONTS.serif]: InstrumentSerif_400Regular,
    [FONTS.serifItalic]: InstrumentSerif_400Regular_Italic,
    [FONTS.sans]: DMSans_400Regular,
    [FONTS.sansMedium]: DMSans_500Medium,
  });
  // A failed load falls back to system fonts rather than a blank app.
  return loaded || !!error;
}

const INK = "#171311";

export const BRAND = {
  ink: INK,
  /** Ink over the gradient: back arrow, secondary copy. */
  inkSoft: "rgba(23,19,17,0.55)",
  inkMuted: "rgba(23,19,17,0.45)",
  inkFaint: "rgba(23,19,17,0.22)",
  /** Dividers between rows on glass. */
  hairline: "rgba(23,19,17,0.1)",
  /** Outlines on inputs and choice buttons. */
  outline: "#8B8B8D",
  outlineSoft: "rgba(139,139,141,0.45)",
  placeholder: "#8B8683",
  paper: "#FFFCFB",
  white: "#FFFFFF",
  /** Frosted surfaces where liquid glass isn't available. */
  glassFill: "rgba(255,255,255,0.5)",
  glassFillStrong: "rgba(255,255,255,0.7)",
  glassEdge: "rgba(255,255,255,0.85)",
  glassTint: "rgba(255,255,255,0.35)",
  disabled: "rgba(23,19,17,0.35)",
  onDisabled: "rgba(255,255,255,0.55)",
  shadow: "#000000",
};

const serif = (fontSize: number, letterSpacing: number, lineHeight?: number) => {
  // A line height tighter than the font clips ascenders on the first line
  // on iOS, so the box gets headroom for them (plus accents). It pushes the
  // title down too, keeping the tall letters clear of the eyebrow above.
  const headroom = lineHeight ? Math.ceil(fontSize - lineHeight) + 10 : 0;
  return {
    fontFamily: FONTS.serif,
    fontSize,
    letterSpacing,
    lineHeight,
    paddingTop: headroom,
    color: INK,
  } satisfies TextStyle;
};

const sans = (
  fontSize: number,
  options: {
    medium?: boolean;
    letterSpacing?: number;
    lineHeight?: number;
  } = {},
) =>
  ({
    fontFamily: options.medium ? FONTS.sansMedium : FONTS.sans,
    fontSize,
    letterSpacing: options.letterSpacing ?? 0,
    lineHeight: options.lineHeight,
    color: INK,
  }) satisfies TextStyle;

export const TYPE = {
  wordmarkLarge: serif(84, -6.5),
  wordmark: serif(24, -0.7),
  title: serif(56, -3, 52),
  titleMedium: serif(43, -0.4, 44),
  metal: serif(26, -0.2),
  eyebrow: sans(9.5, { medium: true, letterSpacing: 2.5 }),
  badge: sans(8.5, { medium: true, letterSpacing: 1.3 }),
  question: sans(17.5, { medium: true }),
  control: sans(15),
  button: sans(14, { medium: true }),
  body: sans(13, { lineHeight: 20 }),
  bodySmall: sans(12, { lineHeight: 19 }),
  caption: sans(10.5),
  fieldLabel: sans(10.5, { medium: true }),
  fieldHint: sans(7.5),
  fieldUnit: sans(7.5, { medium: true, letterSpacing: 0.6 }),
  traits: sans(9, { medium: true, letterSpacing: 1.9 }),
  metalLabel: sans(7.5, { medium: true, letterSpacing: 2.2 }),
  metalBody: sans(10, { lineHeight: 16 }),
  footnote: sans(8.5),
};
