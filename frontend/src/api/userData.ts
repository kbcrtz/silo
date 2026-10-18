import AsyncStorage from "@react-native-async-storage/async-storage";
import { uuidV4 } from "@/lib/cloud";
import { API_URL, USE_MOCKS, apiHeaders, expectOk } from "./config";

const DEVICE_KEY = "silo.device";
let deviceId: Promise<string> | null = null;

/** This install's anonymous id, made on first use and kept on the phone. */
export function getDeviceId(): Promise<string> {
  deviceId ??= AsyncStorage.getItem(DEVICE_KEY).then(async (saved) => {
    if (saved) return saved;
    const fresh = uuidV4();
    await AsyncStorage.setItem(DEVICE_KEY, fresh);
    return fresh;
  });
  return deviceId;
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
