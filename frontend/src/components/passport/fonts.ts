import { DMSans_400Regular } from "@expo-google-fonts/dm-sans/400Regular";
import { DMSans_500Medium } from "@expo-google-fonts/dm-sans/500Medium";
import { InstrumentSerif_400Regular } from "@expo-google-fonts/instrument-serif/400Regular";
import { InstrumentSerif_400Regular_Italic } from "@expo-google-fonts/instrument-serif/400Regular_Italic";
import {
  matchFont,
  useFonts,
  type SkFont,
  type SkTypefaceFontProvider,
} from "@shopify/react-native-skia";

/**
 * The brand fonts for Skia, which can't see the ones expo-font loads, so the
 * passport is set in the same type as the rest of onboarding.
 */
export function usePassportFonts(): SkTypefaceFontProvider | null {
  return useFonts({
    serif: [InstrumentSerif_400Regular, InstrumentSerif_400Regular_Italic],
    sans: [DMSans_400Regular, DMSans_500Medium],
  });
}

export const serifFont = (
  mgr: SkTypefaceFontProvider,
  fontSize: number,
  italic = false,
): SkFont =>
  matchFont(
    {
      fontFamily: "serif",
      fontSize,
      fontStyle: italic ? "italic" : "normal",
    },
    mgr,
  );

export const sansFont = (
  mgr: SkTypefaceFontProvider,
  fontSize: number,
  medium = false,
): SkFont =>
  matchFont(
    { fontFamily: "sans", fontSize, fontWeight: medium ? "500" : "400" },
    mgr,
  );
