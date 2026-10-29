import type { ImageSourcePropType } from "react-native";
import type { FamilyId } from "./families";

/** A free-license outfit photo for the paywall's fan, bundled in assets/looks/. */
export type Look = {
  image: ImageSourcePropType;
  /** The photo's Unsplash or Pexels page, which credits the photographer. */
  source: string;
};

/**
 * Five looks per season family and gender, each worn in that family's
 * colors; the third is the fan's center card. shortcut: placeholder photos
 * until Silo has its own; an empty set shows the palette cards instead.
 */
export const LOOKS: Record<FamilyId, { womens: Look[]; mens: Look[] }> = {
  "warm-spring": {
    womens: [
      {
        image: require("../../assets/looks/warm-spring-womens-1.jpg"),
        source: "https://unsplash.com/photos/OT1Fz5gu074",
      },
      {
        image: require("../../assets/looks/warm-spring-womens-2.jpg"),
        source: "https://unsplash.com/photos/8WgGSenRIaE",
      },
      {
        image: require("../../assets/looks/warm-spring-womens-3.jpg"),
        source: "https://unsplash.com/photos/c2hPKqmwDOw",
      },
      {
        image: require("../../assets/looks/warm-spring-womens-4.jpg"),
        source: "https://unsplash.com/photos/is6aO_aYDes",
      },
      {
        image: require("../../assets/looks/warm-spring-womens-5.jpg"),
        source: "https://unsplash.com/photos/7fMDf4LEmjI",
      },
    ],
    mens: [
      {
        image: require("../../assets/looks/warm-spring-mens-1.jpg"),
        source: "https://www.pexels.com/photo/18621124/",
      },
      {
        image: require("../../assets/looks/warm-spring-mens-2.jpg"),
        source: "https://unsplash.com/photos/t3vn-jyl85U",
      },
      {
        image: require("../../assets/looks/warm-spring-mens-3.jpg"),
        source: "https://www.pexels.com/photo/29371349/",
      },
      {
        image: require("../../assets/looks/warm-spring-mens-4.jpg"),
        source: "https://www.pexels.com/photo/8262224/",
      },
      {
        image: require("../../assets/looks/warm-spring-mens-5.jpg"),
        source: "https://www.pexels.com/photo/29704260/",
      },
    ],
  },
  "warm-autumn": {
    womens: [
      {
        image: require("../../assets/looks/warm-autumn-womens-1.jpg"),
        source: "https://unsplash.com/photos/rBxgI_rpZNw",
      },
      {
        image: require("../../assets/looks/warm-autumn-womens-2.jpg"),
        source: "https://unsplash.com/photos/cED8oFhEeNc",
      },
      {
        image: require("../../assets/looks/warm-autumn-womens-3.jpg"),
        source: "https://unsplash.com/photos/s8qnvrHNLZ4",
      },
      {
        image: require("../../assets/looks/warm-autumn-womens-4.jpg"),
        source: "https://unsplash.com/photos/dVR7YSK8Ffc",
      },
      {
        image: require("../../assets/looks/warm-autumn-womens-5.jpg"),
        source: "https://unsplash.com/photos/sv9Dc1UkffU",
      },
    ],
    mens: [
      {
        image: require("../../assets/looks/warm-autumn-mens-1.jpg"),
        source: "https://unsplash.com/photos/VDt-qMYzpdE",
      },
      {
        image: require("../../assets/looks/warm-autumn-mens-2.jpg"),
        source: "https://www.pexels.com/photo/7904116/",
      },
      {
        image: require("../../assets/looks/warm-autumn-mens-3.jpg"),
        source: "https://unsplash.com/photos/pe2RmKATBZw",
      },
      {
        image: require("../../assets/looks/warm-autumn-mens-4.jpg"),
        source: "https://unsplash.com/photos/AsSYMVCo0x0",
      },
      {
        image: require("../../assets/looks/warm-autumn-mens-5.jpg"),
        source: "https://www.pexels.com/photo/38181152/",
      },
    ],
  },
  "cool-summer": {
    womens: [
      {
        image: require("../../assets/looks/cool-summer-womens-1.jpg"),
        source: "https://unsplash.com/photos/VZ8E6l-0_ug",
      },
      {
        image: require("../../assets/looks/cool-summer-womens-2.jpg"),
        source: "https://www.pexels.com/photo/4690510/",
      },
      {
        image: require("../../assets/looks/cool-summer-womens-3.jpg"),
        source: "https://unsplash.com/photos/h-Q20nwrqWk",
      },
      {
        image: require("../../assets/looks/cool-summer-womens-4.jpg"),
        source: "https://www.pexels.com/photo/7351208/",
      },
      {
        image: require("../../assets/looks/cool-summer-womens-5.jpg"),
        source: "https://unsplash.com/photos/gOy3jyEyxK0",
      },
    ],
    mens: [
      {
        image: require("../../assets/looks/cool-summer-mens-1.jpg"),
        source: "https://unsplash.com/photos/SwOvGPVhdcM",
      },
      {
        image: require("../../assets/looks/cool-summer-mens-2.jpg"),
        source: "https://unsplash.com/photos/OSS7Gd9whn8",
      },
      {
        image: require("../../assets/looks/cool-summer-mens-3.jpg"),
        source: "https://www.pexels.com/photo/18836627/",
      },
      {
        image: require("../../assets/looks/cool-summer-mens-4.jpg"),
        source: "https://www.pexels.com/photo/7037535/",
      },
      {
        image: require("../../assets/looks/cool-summer-mens-5.jpg"),
        source: "https://www.pexels.com/photo/4061519/",
      },
    ],
  },
  "cool-winter": {
    womens: [
      {
        image: require("../../assets/looks/cool-winter-womens-1.jpg"),
        source: "https://unsplash.com/photos/wyIhIr7truk",
      },
      {
        image: require("../../assets/looks/cool-winter-womens-2.jpg"),
        source: "https://unsplash.com/photos/EtAV0Z_PmqU",
      },
      {
        image: require("../../assets/looks/cool-winter-womens-3.jpg"),
        source: "https://www.pexels.com/photo/2005355/",
      },
      {
        image: require("../../assets/looks/cool-winter-womens-4.jpg"),
        source: "https://unsplash.com/photos/ifzilsFFqOs",
      },
      {
        image: require("../../assets/looks/cool-winter-womens-5.jpg"),
        source: "https://unsplash.com/photos/gFk-2UqcDBU",
      },
    ],
    mens: [
      {
        image: require("../../assets/looks/cool-winter-mens-1.jpg"),
        source: "https://unsplash.com/photos/Bv_FFvfPZMA",
      },
      {
        image: require("../../assets/looks/cool-winter-mens-2.jpg"),
        source: "https://www.pexels.com/photo/16646775/",
      },
      {
        image: require("../../assets/looks/cool-winter-mens-3.jpg"),
        source: "https://unsplash.com/photos/YGJ9vfuwyUg",
      },
      {
        image: require("../../assets/looks/cool-winter-mens-4.jpg"),
        source: "https://www.pexels.com/photo/20406863/",
      },
      {
        image: require("../../assets/looks/cool-winter-mens-5.jpg"),
        source: "https://www.pexels.com/photo/8059995/",
      },
    ],
  },
};
