/**
 * Twelve-season color analysis. Each season sits at a point on three axes,
 * all -1..1:
 * - warmth: cool (-1) to warm (+1) undertone
 * - depth: light (-1) to deep (+1) overall coloring
 * - clarity: soft/muted (-1) to bright/clear (+1)
 * A person's traits are matched to the nearest season (see lib/colorAnalysis).
 */
export type ColorTraits = { warmth: number; depth: number; clarity: number };

export type SeasonId =
  | "light-spring"
  | "true-spring"
  | "bright-spring"
  | "light-summer"
  | "true-summer"
  | "soft-summer"
  | "soft-autumn"
  | "true-autumn"
  | "deep-autumn"
  | "deep-winter"
  | "true-winter"
  | "bright-winter";

export type Season = {
  id: SeasonId;
  name: string;
  description: string;
  traits: ColorTraits;
  /** Drives the app accent once the user has this season. */
  signature: string;
  best: string[];
  neutrals: string[];
  avoid: string[];
};

export const SEASONS: Record<SeasonId, Season> = {
  "light-spring": {
    id: "light-spring",
    name: "Light Spring",
    description:
      "Warm, delicate and fresh. Light, clear colors with a golden glow.",
    traits: { warmth: 0.5, depth: -1, clarity: 0.3 },
    signature: "#F4A483",
    best: [
      "#F4A483",
      "#FFD58A",
      "#A8D8B9",
      "#8FC9E8",
      "#F7B2C4",
      "#FFE9A8",
      "#B6E3A8",
      "#F9C8A0",
    ],
    neutrals: ["#F5EBDD", "#D9C3A5", "#B89F84", "#8C7A6B"],
    avoid: ["#000000", "#4B2E2B", "#5A2A82", "#2F3E46"],
  },
  "true-spring": {
    id: "true-spring",
    name: "True Spring",
    description:
      "Fully warm and lively. Clear, sunny colors with yellow undertones.",
    traits: { warmth: 1, depth: -0.3, clarity: 0.5 },
    signature: "#F2793B",
    best: [
      "#F2793B",
      "#FFC93C",
      "#3CB371",
      "#2BB5C6",
      "#FF6F61",
      "#9ACD32",
      "#F4B400",
      "#E35D8C",
    ],
    neutrals: ["#F3E2C7", "#C9A27E", "#A0784F", "#6E5440"],
    avoid: ["#000000", "#708090", "#8E7CC3", "#2C2F48"],
  },
  "bright-spring": {
    id: "bright-spring",
    name: "Bright Spring",
    description:
      "Clear and vivid with a warm lean. High-energy, saturated colors.",
    traits: { warmth: 0.5, depth: 0, clarity: 1 },
    signature: "#FF4F7B",
    best: [
      "#FF4F7B",
      "#00B3A6",
      "#FFB000",
      "#3A7BFF",
      "#FF6A3D",
      "#7ED957",
      "#C13FD0",
      "#00C2FF",
    ],
    neutrals: ["#FFF6E9", "#C8B8A6", "#4A4A4A", "#1F2A44"],
    avoid: ["#B8A99A", "#9C8B7A", "#A3A8B0", "#8A7F8D"],
  },
  "light-summer": {
    id: "light-summer",
    name: "Light Summer",
    description: "Cool, airy and gentle. Pastel colors with a soft blue base.",
    traits: { warmth: -0.5, depth: -1, clarity: -0.3 },
    signature: "#9DB4E0",
    best: [
      "#9DB4E0",
      "#F2B5D4",
      "#B8D8D8",
      "#C9B6E4",
      "#A7C7E7",
      "#E8A9B8",
      "#B5D3C1",
      "#D7C4E8",
    ],
    neutrals: ["#F2F0EE", "#C7C9CC", "#9DA3AA", "#6F7782"],
    avoid: ["#000000", "#FF6F00", "#8B4513", "#556B2F"],
  },
  "true-summer": {
    id: "true-summer",
    name: "True Summer",
    description:
      "Fully cool and calm. Medium, slightly muted blues, roses and berries.",
    traits: { warmth: -1, depth: -0.3, clarity: -0.5 },
    signature: "#5B7DB1",
    best: [
      "#5B7DB1",
      "#C2577B",
      "#6CA6A3",
      "#8E7CC3",
      "#4F86C6",
      "#B0547A",
      "#7FA7C9",
      "#9A5B8F",
    ],
    neutrals: ["#E9EBEF", "#A9B0BA", "#6B7480", "#3E4A5C"],
    avoid: ["#FF8C00", "#DAA520", "#8B4513", "#9ACD32"],
  },
  "soft-summer": {
    id: "soft-summer",
    name: "Soft Summer",
    description:
      "Muted and cool-leaning. Dusty, smoky colors that blend rather than pop.",
    traits: { warmth: -0.5, depth: 0, clarity: -1 },
    signature: "#8A9BA8",
    best: [
      "#8A9BA8",
      "#B48A9A",
      "#7E9C8F",
      "#9A8FB0",
      "#6E8AA0",
      "#C49A9A",
      "#8FA89B",
      "#A38FA3",
    ],
    neutrals: ["#E6E1DC", "#B3ADA7", "#7D7873", "#4F4C4A"],
    avoid: ["#FF0000", "#FF8C00", "#000000", "#FFFF00"],
  },
  "soft-autumn": {
    id: "soft-autumn",
    name: "Soft Autumn",
    description:
      "Muted and warm-leaning. Earthy, gentle colors like sage, camel and clay.",
    traits: { warmth: 0.5, depth: 0, clarity: -1 },
    signature: "#B07D62",
    best: [
      "#B07D62",
      "#9CAF88",
      "#C9A66B",
      "#7E8C6A",
      "#C48E7A",
      "#8DA399",
      "#D4B483",
      "#A5806A",
    ],
    neutrals: ["#EDE4D8", "#C4B29B", "#8F7E6A", "#5C5046"],
    avoid: ["#000000", "#FF00FF", "#0000FF", "#FFFFFF"],
  },
  "true-autumn": {
    id: "true-autumn",
    name: "True Autumn",
    description:
      "Fully warm and rich. Golden, spicy colors like rust, mustard and olive.",
    traits: { warmth: 1, depth: 0.3, clarity: -0.5 },
    signature: "#B5541C",
    best: [
      "#B5541C",
      "#D4A017",
      "#6B8E23",
      "#8B5A2B",
      "#C0662D",
      "#2E8B57",
      "#CC7722",
      "#7B3F00",
    ],
    neutrals: ["#EFE2CC", "#C19A6B", "#8B6B47", "#4E3B2A"],
    avoid: ["#000000", "#FF69B4", "#4169E1", "#C0C0C0"],
  },
  "deep-autumn": {
    id: "deep-autumn",
    name: "Deep Autumn",
    description:
      "Deep and warm. Rich, dark colors like espresso, forest and burgundy.",
    traits: { warmth: 0.5, depth: 1, clarity: -0.3 },
    signature: "#7A2E2E",
    best: [
      "#7A2E2E",
      "#2F4F2F",
      "#B8860B",
      "#5C3A21",
      "#8B3A1A",
      "#1F5F5B",
      "#A0522D",
      "#4B3621",
    ],
    neutrals: ["#E8DCC8", "#9C7B5B", "#5A4535", "#2B211B"],
    avoid: ["#FFB6C1", "#ADD8E6", "#E6E6FA", "#C0C0C0"],
  },
  "deep-winter": {
    id: "deep-winter",
    name: "Deep Winter",
    description:
      "Deep and cool. Dark, dramatic colors like black, emerald and wine.",
    traits: { warmth: -0.5, depth: 1, clarity: 0.3 },
    signature: "#5B1A3A",
    best: [
      "#5B1A3A",
      "#0B6E4F",
      "#1C2E6E",
      "#8B0A50",
      "#004D61",
      "#4B0082",
      "#B0003A",
      "#2F4F4F",
    ],
    neutrals: ["#F4F4F6", "#8A8D93", "#3A3D42", "#0D0D0D"],
    avoid: ["#F5DEB3", "#FFDAB9", "#D2B48C", "#F0E68C"],
  },
  "true-winter": {
    id: "true-winter",
    name: "True Winter",
    description: "Fully cool and crisp. Icy brights, true red and jewel tones.",
    traits: { warmth: -1, depth: 0.3, clarity: 0.5 },
    signature: "#1F3FAF",
    best: [
      "#1F3FAF",
      "#C8102E",
      "#00843D",
      "#7A1FA2",
      "#0072CE",
      "#D1006F",
      "#008C95",
      "#2A2A72",
    ],
    neutrals: ["#FFFFFF", "#B0B3B8", "#4A4D52", "#000000"],
    avoid: ["#D2691E", "#DAA520", "#BC8F8F", "#F5DEB3"],
  },
  "bright-winter": {
    id: "bright-winter",
    name: "Bright Winter",
    description:
      "Clear and vivid with a cool lean. Electric colors and sharp contrast.",
    traits: { warmth: -0.5, depth: 0, clarity: 1 },
    signature: "#E6007E",
    best: [
      "#E6007E",
      "#00A3E0",
      "#00B140",
      "#6A0DAD",
      "#FF1E1E",
      "#0047FF",
      "#00CED1",
      "#FFD700",
    ],
    neutrals: ["#FFFFFF", "#9EA2A8", "#2D2F33", "#000000"],
    avoid: ["#C3B091", "#A89F91", "#B5A642", "#8F8170"],
  },
};

export const SEASON_IDS = Object.keys(SEASONS) as SeasonId[];
