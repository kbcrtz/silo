export type GateDecision = "ok" | "rate" | "busy";

/**
 * Per-IP window plus a process-wide cap on calls in flight.
 * Clients idle for a whole window are dropped at most once per window, so rotating IPs don't grow memory.
 */
export function createGate(opts: { windowMs: number; max: number; concurrency: number }) {
  const hits = new Map<string, number[]>();
  let active = 0;
  let swept = Date.now();
  return {
    tryEnter(ip: string): GateDecision {
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
