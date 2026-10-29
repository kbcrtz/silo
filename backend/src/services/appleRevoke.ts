import { importPKCS8, SignJWT } from "jose";
import { HttpError } from "../errors.ts";

/** Revokes a Sign in with Apple user's tokens, from a fresh authorization code the app gets just before deleting. */
export type RevokeApple = (authorizationCode: string) => Promise<void>;

const APPLE = "https://appleid.apple.com";

/** The .p8 as pasted into a hosting dashboard: often on one line with literal \n, sometimes with quotes or spaces around it. */
function pemKey(raw: string): string {
  const text = raw.replace(/\\n/g, "\n").replace(/\r/g, "");
  const end = "-----END PRIVATE KEY-----";
  const from = text.indexOf("-----BEGIN PRIVATE KEY-----");
  const to = text.indexOf(end);
  return from >= 0 && to > from ? text.slice(from, to + end.length) : text;
}

/**
 * Apple requires apps with Sign in with Apple to revoke the user's tokens
 * when they delete their account. Supabase doesn't keep Apple's refresh
 * token, so the app sends a new authorization code; this exchanges it and
 * revokes the result. No Apple token is ever stored. Needs a Sign in with
 * Apple key (.p8) from the Apple Developer account.
 */
export function appleRevoker(opts: { teamId: string; keyId: string; privateKey: string; clientId: string; fetch: typeof globalThis.fetch }): RevokeApple {
  const key = Promise.resolve().then(() => importPKCS8(pemKey(opts.privateKey), "ES256"));
  // A bad key fails each revocation (the deletion still goes ahead), never the server's start.
  key.catch(() => console.error("APPLE_PRIVATE_KEY is not a valid .p8 key; Sign in with Apple revocation is off."));
  const post = (path: string, form: Record<string, string>) =>
    opts.fetch(`${APPLE}${path}`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(form).toString(),
      signal: AbortSignal.timeout(10_000),
    });
  return async (code) => {
    const signing = await key.catch(() => null);
    if (!signing) throw new HttpError("apple_revoke_failed", 502);
    const clientSecret = await new SignJWT({})
      .setProtectedHeader({ alg: "ES256", kid: opts.keyId })
      .setIssuer(opts.teamId)
      .setSubject(opts.clientId)
      .setAudience(APPLE)
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(signing);
    const auth = { client_id: opts.clientId, client_secret: clientSecret };
    const exchanged = await post("/auth/token", { ...auth, code, grant_type: "authorization_code" }).catch(() => null);
    const tokens = exchanged?.ok ? ((await exchanged.json()) as { refresh_token?: string; access_token?: string }) : null;
    const token = tokens?.refresh_token ?? tokens?.access_token;
    if (!token) throw new HttpError("apple_revoke_failed", 502);
    const revoked = await post("/auth/revoke", { ...auth, token, token_type_hint: tokens?.refresh_token ? "refresh_token" : "access_token" }).catch(() => null);
    if (!revoked?.ok) throw new HttpError("apple_revoke_failed", 502);
  };
}
