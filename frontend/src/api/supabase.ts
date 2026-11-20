import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, type Session } from "@supabase/supabase-js";
import { AppState } from "react-native";
import { accountFrom } from "@/lib/account";
import { useAccount } from "@/store/account";
import { USE_MOCKS, setAccessToken, setTokenRefresher } from "./config";
import { identify } from "./purchases";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
// Supabase's own default for this project, named so startSession can read it.
const STORAGE_KEY = url
  ? `sb-${new URL(url).hostname.split(".")[0]}-auth-token`
  : "";

/** Supabase is used for sign-in only; the backend does all data access. */
export const supabase =
  url && key
    ? createClient(url, key, {
        auth: {
          storage: AsyncStorage,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
          storageKey: STORAGE_KEY,
        },
      })
    : null;

/**
 * Picks up the saved session, if any; until Apple/Google sign-in
 * (src/api/auth.ts) there is none, and only selfie analysis talks to the
 * server. Keeps the API's token and useAccount current.
 */
export async function startSession(): Promise<void> {
  if (!supabase || USE_MOCKS) return;
  const auth = supabase.auth;
  auth.onAuthStateChange((event, session) => {
    // Offline with an expired token, Supabase starts with no session but keeps
    // it saved and refreshes it once back online: only a sign-out ends it.
    if (!session && event !== "SIGNED_OUT") return;
    setAccessToken(session?.access_token ?? null);
    useAccount.setState({ account: accountFrom(session) });
    if (session) identify(session.user.id).catch(() => {});
  });
  setTokenRefresher(async () => {
    const { data } = await auth.refreshSession();
    if (data.session) setAccessToken(data.session.access_token);
  });
  // Timers pause in the background; refresh the token when the app comes back.
  AppState.addEventListener("change", (state) =>
    state === "active"
      ? supabase.auth.startAutoRefresh()
      : supabase.auth.stopAutoRefresh(),
  );
  // A saved session whose refresh failed (offline, auth hiccup) stays saved,
  // and auto-refresh retries it.
  const { data } = await auth.getSession();
  if (data.session) return setAccessToken(data.session.access_token);
  // The saved one (an expired token that couldn't refresh offline) keeps the
  // user in the app with their phone's data; requests fail until it refreshes.
  const saved = await AsyncStorage.getItem(STORAGE_KEY).catch(() => null);
  const stored = saved ? (JSON.parse(saved) as Session) : null;
  if (stored?.user && stored.access_token) {
    setAccessToken(stored.access_token);
    useAccount.setState({ account: accountFrom(stored) });
  }
}
