import AsyncStorage from "@react-native-async-storage/async-storage";
import type { CatalogItem } from "@/data/catalog";
import { eventFor, uuidV4, type EventKind } from "@/lib/cloud";
import { API_URL, USE_MOCKS, apiHeaders, expectOk } from "./config";

const DEVICE_KEY = "silo.device";
let deviceId: Promise<string> | null = null;

/** This install's anonymous id, made on first use and kept on the phone. */
export function getDeviceId(): Promise<string> {
  deviceId ??= AsyncStorage.getItem(DEVICE_KEY)
    .then(async (saved) => {
      if (saved) return saved;
      const fresh = uuidV4();
      await AsyncStorage.setItem(DEVICE_KEY, fresh);
      return fresh;
    })
    .catch((e) => {
      deviceId = null; // don't keep a failed read for the whole session
      throw e;
    });
  return deviceId;
}

/**
 * "Reset": deletes this device's backup on the server, then forgets the id so
 * the next backup starts a new one. The id is dropped first, so a backup that
 * fires meanwhile can't write under the old id again.
 */
export async function forgetDevice() {
  const old = await AsyncStorage.getItem(DEVICE_KEY);
  deviceId = null;
  await AsyncStorage.removeItem(DEVICE_KEY);
  if (USE_MOCKS || !old) return;
  await fetch(`${API_URL}/me`, {
    method: "DELETE",
    headers: { ...apiHeaders(), "x-device-id": old },
  }).then(expectOk);
}

export type Backup = {
  profile: Record<string, unknown> | null;
  saved: Record<string, unknown> | null;
  measurements: { type: string; value: number; measuredAt: string }[];
};

/** The server copy for this phone's existing device id; null when there is no id yet (nothing was ever backed up). */
export async function fetchBackup(): Promise<Backup | null> {
  const id = await AsyncStorage.getItem(DEVICE_KEY);
  if (USE_MOCKS || !id) return null;
  const res = await fetch(`${API_URL}/me`, {
    headers: { ...apiHeaders(), "x-device-id": id },
  }).then(expectOk);
  return res.json();
}

async function send(method: "PUT" | "POST", path: string, body: unknown) {
  if (USE_MOCKS) return;
  await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      ...apiHeaders(),
      "content-type": "application/json",
      "x-device-id": await getDeviceId(),
    },
    body: JSON.stringify(body),
  }).then(expectOk);
}

/**
 * Backs up the phone's data to the backend (Postgres on Tiger Cloud) under
 * the anonymous device id. The phone stays the source of truth.
 *
 * Backend contract, Authorization: Bearer and x-device-id on each:
 * - PUT /me/profile { data } -> 204
 * - PUT /me/saved { data } -> 204
 * - POST /me/measurements { entries: [{ type, value, measuredAt }] } -> { added }
 * - GET /me -> { profile, saved, measurements }
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
