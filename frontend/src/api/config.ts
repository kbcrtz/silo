import { useMembership } from "@/store/membership";

// Without a trailing slash, so `${API_URL}/path` never doubles it.
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? "").replace(
  /\/+$/,
  "",
);

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

/**
 * Settings a release build can't do without: missing, it would quietly run on
 * demo data, without sign-in or without purchases. The app lists them instead.
 * Each is read by name so Expo inlines it.
 */
export const MISSING_SETTINGS = __DEV__
  ? []
  : Object.entries({
      EXPO_PUBLIC_API_URL: API_URL,
      EXPO_PUBLIC_USE_MOCKS: process.env.EXPO_PUBLIC_USE_MOCKS === "false",
      EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
      EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
        process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID:
        process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
      EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID:
        process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
      EXPO_PUBLIC_REVENUECAT_IOS_KEY:
        process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY,
    })
      .filter(([, value]) => !value)
      .map(([name]) => name);

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** React Native's FormData accepts a file as { uri, name, type }. */
export function fileField(uri: string, name: string) {
  return { uri, name, type: "image/jpeg" } as unknown as Blob;
}

export async function expectOk(res: Response): Promise<Response> {
  // The server's membership check said no: the root layout sends them to the paywall.
  if (res.status === 402) useMembership.setState({ active: false });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res;
}
