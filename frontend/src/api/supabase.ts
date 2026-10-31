import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { AppState } from "react-native";
import { accountFrom } from "@/lib/account";
import { useAccount } from "@/store/account";
import { USE_MOCKS, setAccessToken } from "./config";
import { identify } from "./purchases";

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
 * anonymous Supabase user, which Apple/Google sign-in later links to
 * (src/api/auth.ts). Keeps the API's token and useAccount current.
 */
export async function startSession(): Promise<void> {
  if (!supabase || USE_MOCKS) return;
  supabase.auth.onAuthStateChange((_event, session) => {
    setAccessToken(session?.access_token ?? null);
    useAccount.setState({ account: accountFrom(session) });
    if (session) identify(session.user.id).catch(() => {});
  });
  // Timers pause in the background; refresh the token when the app comes back.
  AppState.addEventListener("change", (state) =>
    state === "active"
      ? supabase.auth.startAutoRefresh()
      : supabase.auth.stopAutoRefresh(),
  );
  const { data, error } = await supabase.auth.getSession();
  if (data.session) return setAccessToken(data.session.access_token);
  // A saved session whose refresh failed (offline, auth hiccup) stays saved and
  // auto-refresh retries it; a new anonymous user here would sign the member out.
  if (error) return;
  await signInAnonymously();
}

/** A fresh anonymous user: at first launch, and after signing out. */
export async function signInAnonymously(): Promise<void> {
  if (!supabase) return;
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  setAccessToken(data.session?.access_token ?? null);
}
