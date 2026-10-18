import { createHash, timingSafeEqual } from "node:crypto";

/** SHA-256 both sides so the compare stays constant-time for any token length. */
export function bearerOk(header: string | undefined, secret: string): boolean {
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";
  const a = createHash("sha256").update(token).digest();
  const b = createHash("sha256").update(secret).digest();
  return timingSafeEqual(a, b);
}

export type GateDecision = "ok" | "rate" | "busy";

/**
 * Per-IP window plus a process-wide cap on calls in flight.
 * shortcut: an IP's timestamps stay until that IP calls again, or until restart.
 */
export function createGate(opts: { windowMs: number; max: number; concurrency: number }) {
  const hits = new Map<string, number[]>();
  let active = 0;
  return {
    tryEnter(ip: string): GateDecision {
      const now = Date.now();
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
  };
}

export type Gate = ReturnType<typeof createGate>;
