export type PlanId = "annual" | "monthly" | "weekly";

export type Period = "year" | "month" | "week";

export type Plan = {
  id: PlanId;
  /** Price per period, in US cents. */
  cents: number;
  period: Period;
};

/**
 * Silo is paid only: no free tier, no trial. shortcut: fixed placeholder
 * prices; the paywall is front end only until the App Store products exist.
 */
export const PLANS: Record<PlanId, Plan> = {
  annual: { id: "annual", cents: 4999, period: "year" },
  monthly: { id: "monthly", cents: 599, period: "month" },
  weekly: { id: "weekly", cents: 199, period: "week" },
};

const PER_YEAR: Record<Period, number> = { year: 1, month: 12, week: 52 };

/** What a year of `plan` costs, in cents. */
export const yearCost = (plan: Plan) => plan.cents * PER_YEAR[plan.period];

/** "$39.99"; whole dollars drop the cents: "$40". */
export function formatPrice(cents: number): string {
  const dollars = cents / 100;
  return `$${Number.isInteger(dollars) ? dollars : dollars.toFixed(2)}`;
}

/** The annual price spread over twelve months, rounded down to the cent. */
export function perMonth(plan: Plan): number {
  return plan.period === "year" ? Math.floor(plan.cents / 12) : plan.cents;
}

/** How much one plan's year saves over another's, in whole percent; 0 when the other's cost is unknown. */
export function savingsPercent(yearly: number, otherYearly: number): number {
  if (!otherYearly) return 0;
  return Math.max(0, Math.floor((1 - yearly / otherYearly) * 100));
}

/** Splits a palette into `count` runs of colors, one per card in the fan. */
export function paletteRuns(palette: string[], count: number): string[][] {
  const size = Math.max(1, Math.floor(palette.length / count));
  return Array.from({ length: count }, (_, i) =>
    palette.slice(i * size, i * size + size),
  ).filter((run) => run.length);
}

/**
 * The looks for the fan: the shopper's own set, or for "both" the two sets
 * taken in turn. Nothing when there aren't `count` to show, so the fan falls
 * back to the palette.
 */
export function pickLooks<T>(
  sets: { womens: T[]; mens: T[] },
  shopFor: "womens" | "mens" | "both",
  count: number,
): T[] {
  const turns = Math.max(sets.womens.length, sets.mens.length);
  const looks =
    shopFor === "both"
      ? Array.from({ length: turns }, (_, i) => [sets.womens[i], sets.mens[i]])
          .flat()
          .filter((look): look is T => look !== undefined)
      : sets[shopFor];
  return looks.length >= count ? looks.slice(0, count) : [];
}
