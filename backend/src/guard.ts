export type GateDecision = "ok" | "rate" | "busy";

/**
 * Who a key counts as: an IPv6 address by its /64 (one household or server
 * owns the whole block), an IPv4-mapped one by its IPv4 part, anything else
 * (IPv4, user ids) as it is.
 */
export function clientKey(key: string): string {
  if (!key.includes(":")) return key;
  const v4 = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(key);
  if (v4) return v4[1];
  const [head, tail] = key.split("::");
  const front = head ? head.split(":") : [];
  const back = tail === undefined ? [] : tail ? tail.split(":") : [];
  const groups = tail === undefined ? front : [...front, ...Array(8 - front.length - back.length).fill("0"), ...back];
  return `${groups.slice(0, 4).map((g) => parseInt(g || "0", 16).toString(16)).join(":")}::/64`;
}

/**
 * Per-client window (see clientKey) plus a process-wide cap on calls in flight.
 * Clients idle for a whole window are dropped at most once per window, so rotating IPs don't grow memory.
 */
export function createGate(opts: { windowMs: number; max: number; concurrency: number }) {
  const hits = new Map<string, number[]>();
  let active = 0;
  let swept = Date.now();
  return {
    tryEnter(id: string): GateDecision {
      const ip = clientKey(id);
      const now = Date.now();
      if (now - swept >= opts.windowMs) {
        for (const [key, times] of hits) if (!times.some((t) => now - t < opts.windowMs)) hits.delete(key);
        swept = now;
      }
      const recent = (hits.get(ip) ?? []).filter((t) => now - t < opts.windowMs);
      if (recent.length >= opts.max) {
        hits.set(ip, recent);
        return "rate";
      }
      if (active >= opts.concurrency) return "busy";
      recent.push(now);
      hits.set(ip, recent);
      active++;
      return "ok";
    },
    leave() {
      active = Math.max(0, active - 1);
    },
    tracked: () => hits.size,
  };
}

export type Gate = ReturnType<typeof createGate>;
