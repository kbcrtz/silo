import { AESTHETICS, aestheticsFor, examplesFor } from "@/data/aesthetics";
import { profileSnapshot } from "../cloud";
import {
  describeTaste,
  MAX_LOOKS,
  toggleLook,
  type StatedTaste,
} from "../taste";

const stated = (patch: Partial<StatedTaste> = {}): StatedTaste => ({
  liked: [],
  rejected: [],
  colorStyle: "none",
  via: "onboarding",
  at: "2026-11-19T12:00:00.000Z",
  ...patch,
});

describe("style looks", () => {
  it("each department offers its own looks; both offers every look", () => {
    expect(aestheticsFor("womens")).toEqual([
      "minimal",
      "classic",
      "casual",
      "streetwear",
      "sporty",
      "preppy",
      "boho",
      "romantic",
      "edgy",
    ]);
    expect(aestheticsFor("mens")).toEqual([
      "minimal",
      "classic",
      "casual",
      "streetwear",
      "sporty",
      "preppy",
      "workwear",
      "retro",
    ]);
    expect(aestheticsFor("both")).toEqual([...AESTHETICS]);
  });

  it("examples come from the department's own pieces", () => {
    expect(examplesFor("preppy", "mens")).toMatch(/Rugby/);
    expect(examplesFor("preppy", "womens")).toMatch(/argyle/);
    expect(examplesFor("workwear", "both")).toMatch(/Chore/);
  });
});

describe("toggleLook", () => {
  it("turns a look on and off, and never past three", () => {
    expect(toggleLook([], "minimal")).toEqual(["minimal"]);
    expect(toggleLook(["minimal"], "minimal")).toEqual([]);
    const full = toggleLook(
      toggleLook(toggleLook([], "minimal"), "classic"),
      "boho",
    );
    expect(full).toHaveLength(MAX_LOOKS);
    expect(toggleLook(full, "edgy")).toBe(full);
  });
});

describe("describeTaste", () => {
  it("names the looks and the color answer, leaving out 'a mix'", () => {
    expect(
      describeTaste(
        stated({ liked: ["streetwear", "minimal"], colorStyle: "minimal" }),
      ),
    ).toBe("Streetwear, Minimal · Neutrals");
    expect(describeTaste(stated({ liked: ["boho"] }))).toBe("Boho");
    expect(describeTaste(stated())).toBeNull();
    expect(describeTaste(undefined)).toBeNull();
  });
});

describe("taste in the profile backup", () => {
  it("rides in the snapshot and stays far under the server's 32 KB limit", () => {
    const snap = profileSnapshot({
      onboarded: true,
      shopFor: "both",
      taste: {
        stated: stated({
          liked: ["streetwear", "minimal", "classic"],
          rejected: ["boho", "edgy", "sporty", "preppy"],
          colorStyle: "dark",
        }),
        promptDismissedAt: "2026-11-19T12:00:00.000Z",
      },
    });
    expect(snap.taste).toBeDefined();
    expect(JSON.stringify(snap).length).toBeLessThan(16 * 1024);
  });
});
