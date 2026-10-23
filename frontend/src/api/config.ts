// Without a trailing slash, so `${API_URL}/path` never doubles it.
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? "").replace(/\/+$/, "");

let accessToken: string | null = null;

/**
 * The signed-in user's Supabase access token. The sign-in code calls this on
 * sign-in, token refresh and sign-out (null). Logged out, only selfie
 * analysis works and the user's data stays on the phone.
 */
export function setAccessToken(token: string | null) {
  accessToken = token;
}

export const isSignedIn = () => accessToken !== null;

export function apiHeaders(): Record<string, string> {
  return accessToken ? { authorization: `Bearer ${accessToken}` } : {};
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
