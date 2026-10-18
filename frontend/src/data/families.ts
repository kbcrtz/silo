import type { SeasonId } from "./seasons";

/**
 * The four season families the results screen speaks in. Analysis still
 * lands on one of the twelve seasons (data/seasons.ts); a family is how that
 * result is presented: its name, its 20-color palette and its background.
 */
export type FamilyId =
  "warm-spring" | "warm-autumn" | "cool-summer" | "cool-winter";

export type Metal = "gold" | "silver";

export type Family = {
  id: FamilyId;
  /** "Warm" and "Spring": the title sets the two on their own lines. */
  temperature: string;
  season: string;
  description: string;
  /** Five columns by four rows, read left to right. */
  palette: string[];
  metal: Metal;
};

export const FAMILIES: Record<FamilyId, Family> = {
  "warm-spring": {
    id: "warm-spring",
    temperature: "Warm",
    season: "Spring",
    description:
      "Clear, warm tones bring out your natural glow. Look for coral, golden yellow and fresh turquoise.",
    palette: [
      "#E80322",
      "#FB4421",
      "#FFAE0A",
      "#FEBF8F",
      "#FDCDC3",
      "#9F504D",
      "#FCB310",
      "#E4AF59",
      "#F2D863",
      "#EAC784",
      "#963F76",
      "#385994",
      "#00709F",
      "#7E9BC3",
      "#939DAA",
      "#00BDAD",
      "#0CAC27",
      "#74C664",
      "#9ED248",
      "#FBF0BD",
    ],
    metal: "gold",
  },
  "warm-autumn": {
    id: "warm-autumn",
    temperature: "Warm",
    season: "Autumn",
    description:
      "Rich, earthy tones feel naturally grounded on you. Look for rust, olive and deep teal.",
    palette: [
      "#372411",
      "#82381A",
      "#9E6D35",
      "#B07D32",
      "#E7AE5E",
      "#B10815",
      "#F71A2D",
      "#FA0A29",
      "#FA7F1F",
      "#FF9B13",
      "#362416",
      "#492B63",
      "#007686",
      "#00BCAB",
      "#31AFC7",
      "#004A29",
      "#5E7F15",
      "#B9BF3C",
      "#9BAD67",
      "#F2DBBB",
    ],
    metal: "gold",
  },
  "cool-summer": {
    id: "cool-summer",
    temperature: "Cool",
    season: "Summer",
    description:
      "Gentle, cool tones feel naturally balanced on you. Look for dusty rose, soft blue and quiet lavender.",
    palette: [
      "#D90C2D",
      "#CC4980",
      "#FF6DAD",
      "#FF99C3",
      "#FFCBD5",
      "#5B322A",
      "#513829",
      "#6F4E3F",
      "#866556",
      "#BA9B9B",
      "#00AC6B",
      "#13AB68",
      "#9AD3AA",
      "#F8F3B2",
      "#F6F6E0",
      "#33415E",
      "#565A66",
      "#3384B1",
      "#5EBFF0",
      "#CBECF3",
    ],
    metal: "silver",
  },
  "cool-winter": {
    id: "cool-winter",
    temperature: "Cool",
    season: "Winter",
    description:
      "Crisp, high-contrast tones look striking on you. Look for true red, emerald and icy blue.",
    palette: [
      "#C40828",
      "#D8021B",
      "#FA237C",
      "#FD5F9A",
      "#F59DC1",
      "#382514",
      "#372412",
      "#848385",
      "#C9C9CB",
      "#DFD3E1",
      "#232951",
      "#004B29",
      "#00AE65",
      "#D2E7D9",
      "#E9EFD6",
      "#262757",
      "#003598",
      "#5EBFF0",
      "#D8EEF6",
      "#F5F5F3",
    ],
    metal: "silver",
  },
};

/** Which family a twelve-season result belongs to. */
export function familyOf(seasonId: SeasonId): FamilyId {
  if (seasonId.endsWith("spring")) return "warm-spring";
  if (seasonId.endsWith("autumn")) return "warm-autumn";
  if (seasonId.endsWith("summer")) return "cool-summer";
  return "cool-winter";
}

export const METALS: Record<Metal, { name: string; description: string }> = {
  gold: {
    name: "Gold",
    description: "Soft gold enhances the warm, radiant quality of your tone.",
  },
  silver: {
    name: "Silver",
    description: "Soft silver echoes the cool, delicate quality of your tone.",
  },
};
