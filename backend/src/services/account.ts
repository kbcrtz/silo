import { HttpError } from "../errors.ts";

/** Deletes a user's account; their data goes with it (ON DELETE in the migrations). */
export type DeleteAccount = (userId: string) => Promise<void>;

/** Supabase Auth's admin API, called with the project's secret key (never shipped in the app). */
export function supabaseAccounts({ url, secretKey, fetch }: { url: string; secretKey: string; fetch: typeof globalThis.fetch }): DeleteAccount {
  return async (userId) => {
    const headers: Record<string, string> = { apikey: secretKey };
    // Legacy service_role keys are JWTs and also go in Authorization; new sb_secret_ keys go in apikey only.
    if (secretKey.startsWith("ey")) headers.authorization = `Bearer ${secretKey}`;
    const res = await fetch(`${url}/auth/v1/admin/users/${encodeURIComponent(userId)}`, { method: "DELETE", headers, signal: AbortSignal.timeout(10_000) }).catch(() => null);
    if (res?.ok || res?.status === 404) return;
    throw new HttpError("account_delete_failed", 502);
  };
}
