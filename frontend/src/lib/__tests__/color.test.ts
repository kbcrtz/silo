import { SEASON_IDS, SEASONS } from "@/data/seasons";
import { buildTheme } from "@/theme";
import { contrastRatio, deltaE, ensureContrast, readableOn } from "../color";
import { paletteMatch } from "../paletteMatch";

describe("color math", () => {
  it("measures identical colors as zero distance", () => {
    expect(deltaE("#B07D62", "#B07D62")).toBe(0);
    expect(deltaE("#000000", "#FFFFFF")).toBeGreaterThan(90);
  });

  it("picks readable text", () => {
    expect(readableOn("#FFD58A")).toBe("#000000");
    expect(readableOn("#1C2E6E")).toBe("#ffffff");
  });

  it("darkens a pastel until it is legible", () => {
    expect(
      contrastRatio(ensureContrast("#F7B2C4", "#FFFFFF"), "#FFFFFF"),
    ).toBeGreaterThanOrEqual(4.5);
  });
});

describe("paletteMatch", () => {
  const softAutumn = SEASONS["soft-autumn"];

  it("rates a palette color as a great match", () => {
    expect(paletteMatch(["#9CAF88"], softAutumn).label).toBe("Great match");
  });

  it("rates an avoid color below a palette color", () => {
    const good = paletteMatch(["#C19A6B"], softAutumn).score;
    const bad = paletteMatch(["#FF00FF"], softAutumn).score;
    expect(bad).toBeLessThan(good);
    expect(bad).toBeLessThan(35);
  });
});

describe("buildTheme", () => {
  it.each(SEASON_IDS)("%s keeps text legible", (id) => {
    const { colors } = buildTheme(id);
    expect(contrastRatio(colors.text, colors.bg)).toBeGreaterThanOrEqual(7);
    expect(contrastRatio(colors.textMuted, colors.bg)).toBeGreaterThanOrEqual(
      4.5,
    );
    expect(contrastRatio(colors.accentText, colors.bg)).toBeGreaterThanOrEqual(
      4.5,
    );
    expect(
      contrastRatio(colors.onAccent, colors.accent),
    ).toBeGreaterThanOrEqual(3);
  });
});
