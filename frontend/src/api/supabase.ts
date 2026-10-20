import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { AppState } from "react-native";
import { USE_MOCKS, setAccessToken } from "./config";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

/** Supabase is used for sign-in only; the backend does all data access. */
export const supabase =
  url && key
    ? createClient(url, key, {
        auth: {
          storage: AsyncStorage,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
        },
      })
    : null;

/**
 * Signs in before the app talks to the server: the saved session, else a new
 * anonymous Supabase user. Keeps the API's token current on refresh.
 * shortcut: a silent anonymous user stands in for Apple/Google sign-in so
 * TestFlight builds work; link Apple/Google to it (linkIdentity) when sign-in ships.
 */
export async function startSession(): Promise<void> {
  if (!supabase || USE_MOCKS) return;
  supabase.auth.onAuthStateChange((_event, session) =>
    setAccessToken(session?.access_token ?? null),
  );
  // Timers pause in the background; refresh the token when the app comes back.
  AppState.addEventListener("change", (state) =>
    state === "active"
      ? supabase.auth.startAutoRefresh()
      : supabase.auth.stopAutoRefresh(),
  );
  const { data } = await supabase.auth.getSession();
  if (data.session) return setAccessToken(data.session.access_token);
  const { data: anon, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  setAccessToken(anon.session?.access_token ?? null);
}
