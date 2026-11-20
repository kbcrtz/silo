import type { DeckPhotos } from "@/lib/styleDeck";

/**
 * The onboarding swipe deck: two free-license outfit photos (Unsplash or
 * Pexels) per look and department, bundled in assets/deck/ at 600x840.
 * Sources and credits are in assets/deck/SOURCES.json. A look with no
 * photos is left out of the deck.
 */
export const DECK_PHOTOS: DeckPhotos<number> = {
  womens: {
    minimal: [
      require("../../assets/deck/womens-minimal-1.jpg"),
      require("../../assets/deck/womens-minimal-2.jpg"),
    ],
    classic: [
      require("../../assets/deck/womens-classic-1.jpg"),
      require("../../assets/deck/womens-classic-2.jpg"),
    ],
    casual: [
      require("../../assets/deck/womens-casual-1.jpg"),
      require("../../assets/deck/womens-casual-2.jpg"),
    ],
    streetwear: [
      require("../../assets/deck/womens-streetwear-1.jpg"),
      require("../../assets/deck/womens-streetwear-2.jpg"),
    ],
    sporty: [
      require("../../assets/deck/womens-sporty-1.jpg"),
      require("../../assets/deck/womens-sporty-2.jpg"),
    ],
    preppy: [
      require("../../assets/deck/womens-preppy-1.jpg"),
      require("../../assets/deck/womens-preppy-2.jpg"),
    ],
    boho: [
      require("../../assets/deck/womens-boho-1.jpg"),
      require("../../assets/deck/womens-boho-2.jpg"),
    ],
    romantic: [
      require("../../assets/deck/womens-romantic-1.jpg"),
      require("../../assets/deck/womens-romantic-2.jpg"),
    ],
    edgy: [
      require("../../assets/deck/womens-edgy-1.jpg"),
      require("../../assets/deck/womens-edgy-2.jpg"),
    ],
  },
  mens: {
    minimal: [
      require("../../assets/deck/mens-minimal-1.jpg"),
      require("../../assets/deck/mens-minimal-2.jpg"),
    ],
    classic: [
      require("../../assets/deck/mens-classic-1.jpg"),
      require("../../assets/deck/mens-classic-2.jpg"),
    ],
    casual: [
      require("../../assets/deck/mens-casual-1.jpg"),
      require("../../assets/deck/mens-casual-2.jpg"),
    ],
    streetwear: [
      require("../../assets/deck/mens-streetwear-1.jpg"),
      require("../../assets/deck/mens-streetwear-2.jpg"),
    ],
    sporty: [
      require("../../assets/deck/mens-sporty-1.jpg"),
      require("../../assets/deck/mens-sporty-2.jpg"),
    ],
    preppy: [
      require("../../assets/deck/mens-preppy-1.jpg"),
      require("../../assets/deck/mens-preppy-2.jpg"),
    ],
    workwear: [
      require("../../assets/deck/mens-workwear-1.jpg"),
      require("../../assets/deck/mens-workwear-2.jpg"),
    ],
    retro: [
      require("../../assets/deck/mens-retro-1.jpg"),
      require("../../assets/deck/mens-retro-2.jpg"),
    ],
  },
};
