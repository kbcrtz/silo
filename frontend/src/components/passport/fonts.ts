import { DMSans_400Regular } from "@expo-google-fonts/dm-sans/400Regular";
import { DMSans_500Medium } from "@expo-google-fonts/dm-sans/500Medium";
import { InstrumentSerif_400Regular } from "@expo-google-fonts/instrument-serif/400Regular";
import { InstrumentSerif_400Regular_Italic } from "@expo-google-fonts/instrument-serif/400Regular_Italic";
import {
  matchFont,
  Skia,
  type SkFont,
  type SkFontMgr,
} from "@shopify/react-native-skia";
import { useEffect, useState } from "react";
import { Image } from "react-native";

/** The font manager the passport draws with, and the family names to ask it for. */
export type PassportFonts = { mgr: SkFontMgr; serif: string; sans: string };

/** Brand fonts by family, as they're registered with Skia. */
const BRAND = {
  serif: [InstrumentSerif_400Regular, InstrumentSerif_400Regular_Italic],
  sans: [DMSans_400Regular, DMSans_500Medium],
};
/** iOS system fonts closest to the brand pair, for when those can't load. */
const SYSTEM = { serif: "Georgia", sans: "Helvetica Neue" };
/** Past this, the card is drawn in system fonts rather than left blank. */
const LOAD_TIMEOUT_MS = 8000;

async function loadBrandFonts(): Promise<SkFontMgr> {
  const mgr = Skia.TypefaceFontProvider.Make();
  await Promise.all(
    Object.entries(BRAND).flatMap(([family, modules]) =>
      modules.map(async (module) => {
        // A dev build fetches these from Metro; a release build reads them from the app.
        const data = await Skia.Data.fromURI(
          Image.resolveAssetSource(module).uri,
        );
        const typeface = Skia.Typeface.MakeFreeTypeFaceFromData(data);
        if (!typeface) throw new Error(`Couldn't read the ${family} font`);
        mgr.registerFont(typeface, family);
      }),
    ),
  );
  return mgr;
}

const systemFonts = (): PassportFonts => ({
  mgr: Skia.FontMgr.System(),
  ...SYSTEM,
});

/**
 * The brand fonts for Skia, which can't see the ones expo-font loads, so the
 * passport is set in the same type as the rest of onboarding. If they can't
 * load (in a dev build, Metro stopped) or take too long, the card falls back
 * to iOS system fonts instead of staying blank. Null while loading.
 */
export function usePassportFonts(): PassportFonts | null {
  const [fonts, setFonts] = useState<PassportFonts | null>(null);
  useEffect(() => {
    let settled = false;
    const settle = (next: PassportFonts) => {
      if (settled) return;
      settled = true;
      setFonts(next);
    };
    const timer = setTimeout(() => settle(systemFonts()), LOAD_TIMEOUT_MS);
    loadBrandFonts().then(
      (mgr) => settle({ mgr, serif: "serif", sans: "sans" }),
      () => settle(systemFonts()),
    );
    return () => {
      // Unmounted: drop whatever arrives late.
      settled = true;
      clearTimeout(timer);
    };
  }, []);
  return fonts;
}

export const serifFont = (
  fonts: PassportFonts,
  fontSize: number,
  italic = false,
): SkFont =>
  matchFont(
    {
      fontFamily: fonts.serif,
      fontSize,
      fontStyle: italic ? "italic" : "normal",
    },
    fonts.mgr,
  );

export const sansFont = (
  fonts: PassportFonts,
  fontSize: number,
  medium = false,
): SkFont =>
  matchFont(
    { fontFamily: fonts.sans, fontSize, fontWeight: medium ? "500" : "400" },
    fonts.mgr,
  );
