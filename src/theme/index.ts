import { useMemo } from "react";
import { SEASONS, type Season, type SeasonId } from "@/data/seasons";
import { ensureContrast, mix, readableOn } from "@/lib/color";
import { useProfile } from "@/store/profile";

export type Theme = {
  season: Season | null;
  colors: {
    bg: string;
    surface: string;
    border: string;
    text: string;
    textMuted: string;
    accent: string;
    /** Text/icons drawn on top of accent. */
    onAccent: string;
    /** Accent darkened enough to use as text on bg. */
    accentText: string;
    danger: string;
  };
  space: (n: number) => number;
  radius: { sm: number; md: number; lg: number; pill: number };
  type: {
    display: { fontSize: number; fontWeight: "700"; letterSpacing: number };
    title: { fontSize: number; fontWeight: "700" };
    heading: { fontSize: number; fontWeight: "600" };
    body: { fontSize: number; fontWeight: "400" };
    caption: { fontSize: number; fontWeight: "500" };
  };
};

const shared = {
  space: (n: number) => n * 4,
  radius: { sm: 8, md: 14, lg: 22, pill: 999 },
  type: {
    display: { fontSize: 40, fontWeight: "700", letterSpacing: -1 },
    title: { fontSize: 28, fontWeight: "700" },
    heading: { fontSize: 18, fontWeight: "600" },
    body: { fontSize: 16, fontWeight: "400" },
    caption: { fontSize: 13, fontWeight: "500" },
  },
} as const;

/**
 * Light theme. Before color analysis it is neutral greys with a black accent.
 * Afterwards the accent is the season's signature color and the background
 * and surfaces are faint tints of its lightest neutral and signature, so the
 * whole app takes on the user's palette.
 */
export function buildTheme(seasonId: SeasonId | null | undefined): Theme {
  const season = seasonId ? SEASONS[seasonId] : null;
  if (!season) {
    return {
      ...shared,
      season: null,
      colors: {
        bg: "#FAFAF8",
        surface: "#FFFFFF",
        border: "#E4E4E0",
        text: "#141414",
        textMuted: "#6B6B66",
        accent: "#141414",
        onAccent: "#FFFFFF",
        accentText: "#141414",
        danger: "#C62828",
      },
    };
  }
  const lightestNeutral = season.neutrals[0];
  const bg = mix(lightestNeutral, "#FFFFFF", 0.7);
  const text = ensureContrast(
    mix(season.neutrals[season.neutrals.length - 1], "#141414", 0.6),
    bg,
    12,
  );
  return {
    ...shared,
    season,
    colors: {
      bg,
      surface: mix(season.signature, "#FFFFFF", 0.92),
      border: mix(season.signature, "#FFFFFF", 0.75),
      text,
      textMuted: ensureContrast(mix(text, bg, 0.45), bg, 4.5),
      accent: season.signature,
      onAccent: readableOn(season.signature),
      accentText: ensureContrast(season.signature, bg, 4.5),
      danger: "#C62828",
    },
  };
}

export function useTheme(): Theme {
  const seasonId = useProfile((s) => s.colorProfile?.seasonId);
  return useMemo(() => buildTheme(seasonId), [seasonId]);
}
