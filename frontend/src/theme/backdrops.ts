import type { FamilyId } from "@/data/families";

/**
 * The onboarding gradients, as soft ovals over a base color. Positions and
 * sizes are in points on the 402pt-wide design frame, measured from the top;
 * blur is the Gaussian sigma. The values were fitted to the design frames, so
 * each backdrop reproduces its frame rather than approximating it by eye.
 */
export type BackdropId = "neutral" | FamilyId;

export type Blob = {
  x: number;
  y: number;
  rx: number;
  ry: number;
  blur: number;
  color: string;
};

export const FRAME_WIDTH = 402;

export const BACKDROPS: Record<BackdropId, { base: string; blobs: Blob[] }> = {
  neutral: {
    base: "#FFFFFF",
    blobs: [
      { x: 225.1, y: 67.7, rx: 343.6, ry: 274.4, blur: 60.2, color: "#FB8186" },
      {
        x: -45.4,
        y: 268.9,
        rx: 96.5,
        ry: 199.8,
        blur: 260.0,
        color: "#FFFFA5",
      },
      {
        x: 218.7,
        y: 1020.7,
        rx: 433.0,
        ry: 380.4,
        blur: 73.1,
        color: "#9ECFD7",
      },
      {
        x: -30.0,
        y: 780.0,
        rx: 110.5,
        ry: 169.8,
        blur: 112.9,
        color: "#FFD3E1",
      },
      {
        x: 379.9,
        y: 900.6,
        rx: 145.3,
        ry: 200.1,
        blur: 117.1,
        color: "#CCDEE7",
      },
    ],
  },
  "warm-spring": {
    base: "#FFFFF9",
    blobs: [
      { x: 204.1, y: 46.5, rx: 378.7, ry: 319.2, blur: 79.8, color: "#F78491" },
      { x: -43.5, y: 252.1, rx: 66.2, ry: 186.7, blur: 74.5, color: "#E5FFED" },
      {
        x: 202.0,
        y: 1027.2,
        rx: 367.7,
        ry: 386.9,
        blur: 260.0,
        color: "#FFCA95",
      },
      {
        x: -30.0,
        y: 779.9,
        rx: 118.0,
        ry: 174.5,
        blur: 60.8,
        color: "#EEE3DD",
      },
      {
        x: 371.0,
        y: 895.7,
        rx: 148.1,
        ry: 194.5,
        blur: 159.6,
        color: "#F1F9FF",
      },
    ],
  },
  "warm-autumn": {
    base: "#FDEFBA",
    blobs: [
      { x: 236.8, y: 58.1, rx: 341.9, ry: 260.5, blur: 58.1, color: "#FE774A" },
      { x: -49.6, y: 260.2, rx: 86.8, ry: 201.3, blur: 75.3, color: "#FDFFC4" },
      {
        x: 221.1,
        y: 1023.6,
        rx: 423.0,
        ry: 379.6,
        blur: 75.3,
        color: "#FDCB51",
      },
      {
        x: -30.0,
        y: 780.0,
        rx: 110.2,
        ry: 170.3,
        blur: 260.0,
        color: "#FFFFE3",
      },
      {
        x: 380.8,
        y: 900.9,
        rx: 139.6,
        ry: 199.5,
        blur: 147.5,
        color: "#FFA800",
      },
    ],
  },
  "cool-summer": {
    base: "#FFFFFF",
    blobs: [
      { x: 234.6, y: 58.7, rx: 341.0, ry: 262.0, blur: 42.8, color: "#FECAD5" },
      {
        x: -33.7,
        y: 252.9,
        rx: 91.9,
        ry: 197.0,
        blur: 193.1,
        color: "#FF9FAC",
      },
      {
        x: 221.2,
        y: 1016.6,
        rx: 418.4,
        ry: 379.9,
        blur: 66.8,
        color: "#AD0A3A",
      },
      {
        x: -30.0,
        y: 780.0,
        rx: 108.9,
        ry: 170.2,
        blur: 135.1,
        color: "#FFFFFF",
      },
      {
        x: 378.0,
        y: 900.5,
        rx: 139.1,
        ry: 200.7,
        blur: 133.5,
        color: "#C495A9",
      },
    ],
  },
  "cool-winter": {
    base: "#F5FFFF",
    blobs: [
      { x: 212.4, y: 47.8, rx: 298.6, ry: 291.2, blur: 44.7, color: "#88909B" },
      {
        x: -89.9,
        y: 263.1,
        rx: 100.1,
        ry: 224.7,
        blur: 11.8,
        color: "#96B4DD",
      },
      {
        x: 219.4,
        y: 970.7,
        rx: 413.8,
        ry: 488.1,
        blur: 128.7,
        color: "#E2F4F3",
      },
      {
        x: -79.0,
        y: 890.5,
        rx: 156.5,
        ry: 194.0,
        blur: 178.1,
        color: "#00115F",
      },
      {
        x: 356.1,
        y: 995.0,
        rx: 218.2,
        ry: 307.7,
        blur: 103.4,
        color: "#EEECDA",
      },
    ],
  },
};
