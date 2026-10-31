import * as AppleAuthentication from "expo-apple-authentication";
import {
  GoogleSignin,
  isCancelledResponse,
  isErrorWithCode,
  statusCodes,
} from "@react-native-google-signin/google-signin";
import type { Provider } from "@/lib/account";
import { useAccount } from "@/store/account";
import {
  applyBackup,
  clearLocalData,
  installIsEmpty,
  joinBackup,
  restorePhoto,
} from "@/store/backup";
import { useMembership } from "@/store/membership";
import { useProfile } from "@/store/profile";
import { USE_MOCKS, sleep } from "./config";
import { identify } from "./purchases";
import { supabase } from "./supabase";
import { deleteAccount, fetchBackup, mergeAnonymous } from "./userData";

type IdToken = { token: string; givenName?: string };

const codeOf = (e: unknown) => (e as { code?: unknown } | null)?.code;

/** Null when the user closes the Apple sheet. */
async function appleCredential(
  scopes: AppleAuthentication.AppleAuthenticationScope[] = [],
) {
  try {
    return await AppleAuthentication.signInAsync({ requestedScopes: scopes });
  } catch (e) {
    if (codeOf(e) === "ERR_REQUEST_CANCELED") return null;
    throw e;
  }
}

async function appleToken(): Promise<IdToken | null> {
  const c = await appleCredential([
    AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
    AppleAuthentication.AppleAuthenticationScope.EMAIL,
  ]);
  if (!c) return null;
  if (!c.identityToken) throw new Error("Apple sent no identity token.");
  // Apple only sends the name the first time someone signs in to the app.
  return {
    token: c.identityToken,
    givenName: c.fullName?.givenName ?? undefined,
  };
}

let googleReady = false;

async function googleToken(): Promise<IdToken | null> {
  if (!googleReady) {
    // The web client makes the ID token's audience one Supabase accepts.
    GoogleSignin.configure({
      iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
      webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    });
    googleReady = true;
  }
  try {
    const res = await GoogleSignin.signIn();
    if (isCancelledResponse(res)) return null;
    if (!res.data.idToken) throw new Error("Google sent no ID token.");
    return {
      token: res.data.idToken,
      givenName: res.data.user.givenName ?? undefined,
    };
  } catch (e) {
    if (
      isErrorWithCode(e) &&
      (e.code === statusCodes.SIGN_IN_CANCELLED ||
        e.code === statusCodes.IN_PROGRESS)
    )
      return null;
    throw e;
  }
}

/**
 * Signs in with the Apple/Google identity, creating the account the first
 * time. An empty phone then downloads the account; a phone with data keeps its
 * profile and joins the account's. Phones still holding an anonymous user from
 * older builds link it instead (same id), or merge it in (POST /me/merge) when
 * the identity already has an account.
 */
async function connect(provider: Provider, token: string) {
  if (!supabase) throw new Error("Sign-in isn't set up in this build.");
  const { data } = await supabase.auth.getSession();
  const anonymous = data.session?.user.is_anonymous
    ? data.session.access_token
    : null;
  if (anonymous) {
    const linked = await supabase.auth.linkIdentity({ provider, token });
    if (!linked.error) return;
  }
  // Linking failed, normally because the identity already has an account.
  const signedIn = await supabase.auth.signInWithIdToken({ provider, token });
  if (signedIn.error) throw signedIn.error;
  if (installIsEmpty()) {
    const backup = await fetchBackup();
    if (backup) applyBackup(backup);
    // An empty phone has no selfie yet; the account's passport photo is it.
    return restorePhoto();
  }
  // Backups wait for sign-in, so the phone holds the newer onboarding; the
  // merge only moves what older builds uploaded for the anonymous user.
  const backup = anonymous
    ? await mergeAnonymous(anonymous)
    : await fetchBackup();
  if (backup) joinBackup(backup);
}

/** Runs `job` with the backups stopped, so they restart for the right user. */
async function paused<T>(job: () => Promise<T>): Promise<T> {
  useAccount.setState({ syncPaused: true });
  try {
    return await job();
  } finally {
    useAccount.setState({ syncPaused: false });
  }
}

/**
 * Apple or Google sign-in. False when the user cancels. Afterwards the
 * phone's data is on the account; if the account had data from before, the
 * phone now has it too (a restored profile can set `onboarded`).
 */
export function signIn(provider: Provider): Promise<boolean> {
  return paused(async () => {
    if (USE_MOCKS) {
      await sleep(600);
      useAccount.setState({
        account: { kind: "member", userId: "mock-user", provider },
      });
      return true;
    }
    const id = await (provider === "apple" ? appleToken() : googleToken());
    if (!id) return false;
    await connect(provider, id.token);
    // The sign-in step decides paywall or not from the membership, so wait for it.
    const { data } = await supabase!.auth.getSession();
    if (data.session) await identify(data.session.user.id).catch(() => {});
    const profile = useProfile.getState();
    if (!profile.displayName && id.givenName)
      profile.set({ displayName: id.givenName });
    return true;
  });
}

/** Leaves the account: empties the phone and starts over, logged out. */
async function startOver() {
  // Emptied first, so the app goes back to the opening rather than to the
  // sign-in that onboarded users without an account are sent to.
  clearLocalData();
  if (supabase && !USE_MOCKS) {
    await GoogleSignin.signOut().catch(() => {});
    // Signs out locally even when the server can't be reached.
    await supabase.auth.signOut().catch(() => {});
  }
  useAccount.setState({ account: { kind: "none" } });
  // The last account's membership mustn't let the next one past the paywall.
  useMembership.setState({ active: null });
}

/** The account's data stays on the server for the next sign-in. */
export const signOut = () => paused(startOver);

/**
 * Deletes the account and its data, then starts over. Apple accounts sign
 * in once more for a fresh authorization code, which the server uses to
 * revoke the Apple token (Apple's rule). False when that sheet is closed.
 */
export function removeAccount(): Promise<boolean> {
  return paused(async () => {
    const { account } = useAccount.getState();
    let code: string | undefined;
    if (
      !USE_MOCKS &&
      account.kind === "member" &&
      account.provider === "apple"
    ) {
      const c = await appleCredential();
      if (!c) return false;
      code = c.authorizationCode ?? undefined;
    }
    await deleteAccount(code);
    await startOver();
    return true;
  });
}
