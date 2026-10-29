import { File } from "expo-file-system";
import type { CatalogItem } from "@/data/catalog";
import { eventFor, type EventKind } from "@/lib/cloud";
import { newPhotoName, photoUri } from "@/lib/photos";
import {
  API_URL,
  USE_MOCKS,
  apiHeaders,
  expectOk,
  fileField,
  isSignedIn,
} from "./config";

/**
 * Deletes the signed-in user's account and all their data on the server
 * (App Store rule for apps with accounts). Sign out locally afterwards.
 * For an Apple account, pass a fresh `authorizationCode` from
 * AppleAuthentication.signInAsync so the server can revoke the Apple token,
 * which Apple requires.
 */
export async function deleteAccount(appleAuthorizationCode?: string) {
  if (USE_MOCKS) return;
  await fetch(`${API_URL}/me`, {
    method: "DELETE",
    headers: appleAuthorizationCode
      ? { ...apiHeaders(), "content-type": "application/json" }
      : apiHeaders(),
    body: appleAuthorizationCode
      ? JSON.stringify({ appleAuthorizationCode })
      : undefined,
  }).then(expectOk);
}

/**
 * After signing in to an Apple/Google identity that already had an account
 * (linking the anonymous user failed with "identity already exists"): moves
 * the anonymous user's data into the account and returns the merged backup to
 * restore. `anonymousToken` is the anonymous session's access token, kept from
 * before the sign-in; the request itself carries the account's token.
 */
export async function mergeAnonymous(
  anonymousToken: string,
): Promise<Backup | null> {
  if (USE_MOCKS) return null;
  const res = await fetch(`${API_URL}/me/merge`, {
    method: "POST",
    headers: { ...apiHeaders(), "content-type": "application/json" },
    body: JSON.stringify({ anonymousToken }),
  }).then(expectOk);
  return res.json();
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
 * - DELETE /me [{ appleAuthorizationCode }] -> 204 (revokes Apple, deletes the account)
 * - POST /me/merge { anonymousToken } -> { profile, saved, measurements }
 * - PUT /me/photo, GET /me/photo: see uploadPhoto and downloadPhoto
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

/**
 * Saves the selfie as the account's passport photo; the server keeps a ~30 KB copy.
 * Backend contract: PUT /me/photo, multipart `photo` (JPEG, PNG or WebP) -> 204
 */
export async function uploadPhoto(uri: string) {
  if (USE_MOCKS || !isSignedIn()) return;
  const body = new FormData();
  body.append("photo", fileField(uri, "photo.jpg"));
  await fetch(`${API_URL}/me/photo`, {
    method: "PUT",
    headers: apiHeaders(),
    body,
  }).then(expectOk);
}

/**
 * The account's passport photo, saved into the photos directory; returns its
 * file name, or null when there is none (404 no_photo) or the phone is offline.
 * Backend contract: GET /me/photo -> image/jpeg
 */
export async function downloadPhoto(): Promise<string | null> {
  if (USE_MOCKS || !isSignedIn()) return null;
  const name = newPhotoName("selfie");
  try {
    await File.downloadFileAsync(
      `${API_URL}/me/photo`,
      new File(photoUri(name)),
      {
        headers: apiHeaders(),
      },
    );
    return name;
  } catch {
    return null;
  }
}

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
