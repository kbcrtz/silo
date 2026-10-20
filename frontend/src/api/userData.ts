import type { CatalogItem } from "@/data/catalog";
import { eventFor, type EventKind } from "@/lib/cloud";
import { API_URL, USE_MOCKS, apiHeaders, expectOk, isSignedIn } from "./config";

/**
 * Deletes the signed-in user's account and all their data on the server
 * (App Store rule for apps with accounts). Sign out locally afterwards.
 */
export async function deleteAccount() {
  if (USE_MOCKS) return;
  await fetch(`${API_URL}/me`, {
    method: "DELETE",
    headers: apiHeaders(),
  }).then(expectOk);
}

export type Backup = {
  profile: Record<string, unknown> | null;
  saved: Record<string, unknown> | null;
  measurements: { type: string; value: number; measuredAt: string }[];
};

/** The signed-in user's server copy; null when logged out. */
export async function fetchBackup(): Promise<Backup | null> {
  if (USE_MOCKS || !isSignedIn()) return null;
  const res = await fetch(`${API_URL}/me`, { headers: apiHeaders() }).then(
    expectOk,
  );
  return res.json();
}

/** Logged out, nothing is sent: the data stays on the phone until sign-up. */
async function send(method: "PUT" | "POST", path: string, body: unknown) {
  if (USE_MOCKS || !isSignedIn()) return;
  await fetch(`${API_URL}${path}`, {
    method,
    headers: { ...apiHeaders(), "content-type": "application/json" },
    body: JSON.stringify(body),
  }).then(expectOk);
}

/**
 * Saves the phone's data to the signed-in user's account (Supabase Postgres,
 * through the backend). Right after sign-up these move the onboarding answers
 * to the server; afterwards they keep it current. The phone stays the source of truth.
 *
 * Backend contract, Authorization: Bearer <Supabase access token> on each:
 * - PUT /me/profile { data } -> 204 (replaces)
 * - PUT /me/saved { data } -> 204 (replaces)
 * - POST /me/measurements { entries: [{ type, value, measuredAt }] } -> { added } (appends)
 * - GET /me -> { profile, saved, measurements }
 * - DELETE /me -> 204 (deletes the account)
 * No token -> 401 { error: "unauthorized" }.
 */
export const backupProfile = (data: Record<string, unknown>) =>
  send("PUT", "/me/profile", { data });
export const backupSaved = (data: Record<string, unknown>) =>
  send("PUT", "/me/saved", { data });
export const backupMeasurements = (
  entries: { type: string; value: number; measuredAt: string }[],
) =>
  entries.length
    ? send("POST", "/me/measurements", { entries })
    : Promise.resolve();

// Events go in batches: a burst of taps is one request.
const queue: ReturnType<typeof eventFor>[] = [];
let flushTimer: ReturnType<typeof setTimeout> | undefined;

function flush() {
  // The backend takes 100 per request.
  while (queue.length) {
    // Lost on failure: popularity is a nice-to-have, not the user's data.
    send("POST", "/events", { events: queue.splice(0, 100) }).catch(() => {});
  }
}

/**
 * Reports an open, save or Shop tap for "popular with your season".
 * Backend contract: POST /events { events: [{ kind, itemId, season?, garment?, silhouette?, color? }] } -> 204
 */
export function track(
  kind: EventKind,
  item: CatalogItem,
  season: string | undefined,
) {
  queue.push(eventFor(kind, item, season));
  clearTimeout(flushTimer);
  flushTimer = setTimeout(flush, 3000);
}
