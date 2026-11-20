/** Whether the user has an active Silo membership; null when the store can't say right now. */
export type Membership = (userId: string) => Promise<boolean | null>;

/** Members are trusted for a while. Non-members are asked every time, so a purchase or renewal gets in at once. */
const MEMBER_TTL_MS = 5 * 60_000;
/** An outage is remembered this long, so requests don't each wait out the timeout. */
const OUTAGE_TTL_MS = 30_000;

/**
 * RevenueCat's view of a user, by the Supabase user id the app logs purchases
 * under (frontend/src/api/purchases.ts). Every plan unlocks the `member`
 * entitlement; one in its billing grace period still counts.
 */
export function revenueCatMembership(opts: {
  secretKey: string;
  entitlement?: string;
  fetch?: typeof globalThis.fetch;
  timeoutMs?: number;
}): Membership {
  const { secretKey, entitlement = "member", fetch = globalThis.fetch, timeoutMs = 3_000 } = opts;
  const cache = new Map<string, { active: boolean | null; until: number }>();
  // Opening the app fires the feed and several images at once; they share one question to RevenueCat.
  const asking = new Map<string, Promise<boolean | null>>();
  return (userId) => {
    const hit = cache.get(userId);
    if (hit && hit.until > Date.now()) return Promise.resolve(hit.active);
    let pending = asking.get(userId);
    if (!pending) {
      pending = ask(userId).finally(() => asking.delete(userId));
      asking.set(userId, pending);
    }
    return pending;
  };

  async function ask(userId: string): Promise<boolean | null> {
    const now = Date.now();
    try {
      const res = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`, {
        headers: { authorization: `Bearer ${secretKey}` },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!res.ok) return outage(userId, now);
      const body = (await res.json()) as { subscriber?: { entitlements?: Record<string, { expires_date?: string | null; grace_period_expires_date?: string | null }> } };
      const e = body.subscriber?.entitlements?.[entitlement];
      const until = (date?: string | null) => date != null && Date.parse(date) > now;
      const active = !!e && (e.expires_date === null || until(e.expires_date) || until(e.grace_period_expires_date));
      // shortcut: expired entries are only swept at 10k users; a shared cache (or webhooks) when there are several servers.
      if (cache.size > 10_000) for (const [id, v] of cache) if (v.until <= now) cache.delete(id);
      if (active) cache.set(userId, { active, until: now + MEMBER_TTL_MS });
      else cache.delete(userId);
      return active;
    } catch {
      return outage(userId, now);
    }
  }

  function outage(userId: string, now: number): null {
    cache.set(userId, { active: null, until: now + OUTAGE_TTL_MS });
    return null;
  }
}
