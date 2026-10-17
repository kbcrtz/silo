import type { SizeChart } from "@/lib/fit";

/** Generic charts until real retailer charts are wired in. Body measurements, cm. */
export const SIZE_CHARTS: Record<string, SizeChart> = {
  "womens-tops": {
    id: "womens-tops",
    sizes: [
      {
        label: "XS",
        ranges: { chest: [78, 82], waist: [60, 64], armLength: [55, 57] },
      },
      {
        label: "S",
        ranges: { chest: [82, 87], waist: [64, 69], armLength: [56, 58] },
      },
      {
        label: "M",
        ranges: { chest: [87, 93], waist: [69, 75], armLength: [57, 59] },
      },
      {
        label: "L",
        ranges: { chest: [93, 100], waist: [75, 82], armLength: [58, 60] },
      },
      {
        label: "XL",
        ranges: { chest: [100, 108], waist: [82, 90], armLength: [59, 61] },
      },
    ],
  },
  "womens-bottoms": {
    id: "womens-bottoms",
    sizes: [
      {
        label: "XS",
        ranges: { waist: [60, 64], hips: [86, 90], inseam: [74, 80] },
      },
      {
        label: "S",
        ranges: { waist: [64, 69], hips: [90, 95], inseam: [75, 81] },
      },
      {
        label: "M",
        ranges: { waist: [69, 75], hips: [95, 101], inseam: [76, 82] },
      },
      {
        label: "L",
        ranges: { waist: [75, 82], hips: [101, 108], inseam: [77, 83] },
      },
      {
        label: "XL",
        ranges: { waist: [82, 90], hips: [108, 116], inseam: [77, 83] },
      },
    ],
  },
  "womens-dresses": {
    id: "womens-dresses",
    sizes: [
      {
        label: "XS",
        ranges: { chest: [78, 82], waist: [60, 64], hips: [86, 90] },
      },
      {
        label: "S",
        ranges: { chest: [82, 87], waist: [64, 69], hips: [90, 95] },
      },
      {
        label: "M",
        ranges: { chest: [87, 93], waist: [69, 75], hips: [95, 101] },
      },
      {
        label: "L",
        ranges: { chest: [93, 100], waist: [75, 82], hips: [101, 108] },
      },
      {
        label: "XL",
        ranges: { chest: [100, 108], waist: [82, 90], hips: [108, 116] },
      },
    ],
  },
  "mens-tops": {
    id: "mens-tops",
    sizes: [
      {
        label: "S",
        ranges: { chest: [88, 96], waist: [74, 81], armLength: [60, 62] },
      },
      {
        label: "M",
        ranges: { chest: [96, 104], waist: [81, 89], armLength: [61, 63] },
      },
      {
        label: "L",
        ranges: { chest: [104, 112], waist: [89, 97], armLength: [62, 64] },
      },
      {
        label: "XL",
        ranges: { chest: [112, 120], waist: [97, 105], armLength: [63, 65] },
      },
      {
        label: "XXL",
        ranges: { chest: [120, 128], waist: [105, 113], armLength: [64, 66] },
      },
    ],
  },
  "mens-bottoms": {
    id: "mens-bottoms",
    sizes: [
      { label: "S", ranges: { waist: [74, 81], inseam: [76, 81] } },
      { label: "M", ranges: { waist: [81, 89], inseam: [78, 83] } },
      { label: "L", ranges: { waist: [89, 97], inseam: [80, 85] } },
      { label: "XL", ranges: { waist: [97, 105], inseam: [80, 86] } },
      { label: "XXL", ranges: { waist: [105, 113], inseam: [80, 86] } },
    ],
  },
};
