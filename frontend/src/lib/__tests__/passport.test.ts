import { SEASON_IDS, SEASONS } from "@/data/seasons";
import { buildTheme } from "@/theme";
import { contrastRatio } from "../color";
import {
  cardNumber,
  cardStock,
  formatIssued,
  MRZ_LENGTH,
  mrzLines,
  passportName,
  rosettePoints,
} from "../passport";

describe("passport fields", () => {
  it("prints a placeholder until a name is set", () => {
    expect(passportName(undefined)).toBe("SILO MEMBER");
    expect(passportName("  ")).toBe("SILO MEMBER");
    expect(passportName("Kobe Cortez")).toBe("KOBE CORTEZ");
  });

  it("derives a stable card number", () => {
    expect(cardNumber("seed")).toBe(cardNumber("seed"));
    expect(cardNumber("seed")).not.toBe(cardNumber("other"));
    expect(cardNumber("seed")).toMatch(/^SL·[0-9A-F]{4}·[0-9A-F]{4}$/);
  });

  it("formats the issue date passport-style", () => {
    expect(formatIssued(new Date(2026, 9, 7).toISOString())).toBe(
      "07 OCT 2026",
    );
  });
});

describe("mrzLines", () => {
  const lines = mrzLines({
    name: "Zoë O'Brien",
    seasonId: "soft-autumn",
    traits: { warmth: 0.3, depth: 0.07, clarity: -0.46 },
    heightCm: 168.4,
    shape: "hourglass",
  });

  it("produces two fixed-width lines of MRZ-safe characters", () => {
    for (const line of lines) {
      expect(line).toHaveLength(MRZ_LENGTH);
      expect(line).toMatch(/^[A-Z0-9<]+$/);
    }
  });

  it("encodes the holder and their traits", () => {
    expect(lines[0].startsWith("P<SILOZOE<O<BRIEN<<SOFT<AUTUMN")).toBe(true);
    expect(lines[1].startsWith("P30P07M46<H168<HOURGLASS")).toBe(true);
  });

  it("truncates long names instead of overflowing", () => {
    const [line] = mrzLines({
      name: "A".repeat(80),
      seasonId: "true-winter",
      traits: { warmth: 0, depth: 0, clarity: 0 },
    });
    expect(line).toHaveLength(MRZ_LENGTH);
  });
});

describe("rosettePoints", () => {
  it("closes the loop and stays within its radius", () => {
    const pts = rosettePoints(50, 50, 20, 7, 0.4);
    expect(pts[0]).toBeCloseTo(pts[pts.length - 2]);
    expect(pts[1]).toBeCloseTo(pts[pts.length - 1]);
    for (let i = 0; i < pts.length; i += 2) {
      expect(Math.hypot(pts[i] - 50, pts[i + 1] - 50)).toBeLessThanOrEqual(
        20.0001,
      );
    }
  });
});

describe("cardStock", () => {
  it.each(SEASON_IDS)("%s matches the app and keeps ink legible", (id) => {
    const season = SEASONS[id];
    const appBg = buildTheme(id).colors.bg;
    const stock = cardStock(season, appBg);
    expect(stock.colors[0]).toBe(appBg);
    expect(stock.colors).toHaveLength(stock.positions.length);
    for (const stop of stock.colors) {
      expect(contrastRatio(stock.ink, stop)).toBeGreaterThanOrEqual(7);
      expect(contrastRatio(stock.muted, stop)).toBeGreaterThanOrEqual(4.5);
    }
  });
});
