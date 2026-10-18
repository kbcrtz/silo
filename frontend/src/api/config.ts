export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "";

/**
 * Shared gate for the LAN server. EXPO_PUBLIC_ values are compiled into the
 * app, so this stops other devices on the network, not someone who has the app.
 */
export const API_SECRET = process.env.EXPO_PUBLIC_API_SECRET ?? "";

export function apiHeaders(): Record<string, string> {
  return API_SECRET ? { authorization: `Bearer ${API_SECRET}` } : {};
}

/** Mocks stay on until the backend exists, or when no API URL is set. */
export const USE_MOCKS =
  process.env.EXPO_PUBLIC_USE_MOCKS !== "false" || !API_URL;

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** React Native's FormData accepts a file as { uri, name, type }. */
export function fileField(uri: string, name: string) {
  return { uri, name, type: "image/jpeg" } as unknown as Blob;
}

export async function expectOk(res: Response): Promise<Response> {
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res;
}
