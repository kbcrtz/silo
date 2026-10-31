/** Whether the user has an active Silo membership; null when the store can't say right now. */
export type Membership = (userId: string) => Promise<boolean | null>;

/** Members are trusted for a while; non-members are asked again soon, so a fresh purchase gets in quickly. */
const MEMBER_TTL_MS = 5 * 60_000;
const NON_MEMBER_TTL_MS = 30_000;

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
  const cache = new Map<string, { active: boolean; until: number }>();
  return async (userId) => {
    const now = Date.now();
    const hit = cache.get(userId);
    if (hit && hit.until > now) return hit.active;
    try {
      const res = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`, {
        headers: { authorization: `Bearer ${secretKey}` },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!res.ok) return null;
      const body = (await res.json()) as { subscriber?: { entitlements?: Record<string, { expires_date?: string | null; grace_period_expires_date?: string | null }> } };
      const e = body.subscriber?.entitlements?.[entitlement];
      const until = (date?: string | null) => date != null && Date.parse(date) > now;
      const active = !!e && (e.expires_date === null || until(e.expires_date) || until(e.grace_period_expires_date));
      // shortcut: expired entries are only swept at 10k users; a shared cache (or webhooks) when there are several servers.
      if (cache.size > 10_000) for (const [id, v] of cache) if (v.until <= now) cache.delete(id);
      cache.set(userId, { active, until: now + (active ? MEMBER_TTL_MS : NON_MEMBER_TTL_MS) });
      return active;
    } catch {
      return null;
    }
  };
}
