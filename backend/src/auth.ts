import { jwtVerify, type JWTVerifyGetKey } from "jose";
import { z } from "zod";

/** A login token's user, or null when it isn't a valid Supabase session. `anonymous`: the silent sign-in, before Apple/Google. */
export type Verify = (token: string) => Promise<{ id: string; anonymous: boolean } | null>;

const UserId = z.uuid();

/**
 * Checks Supabase Auth access tokens locally against the project's public
 * signing keys (its JWKS), so no request waits on Supabase. Whether an
 * anonymous user counts as signed in is the app's call (ALLOW_ANONYMOUS).
 */
export function supabaseVerifier({ issuer, keys }: { issuer: string; keys: JWTVerifyGetKey }): Verify {
  return async (token) => {
    try {
      const { payload } = await jwtVerify(token, keys, { issuer, audience: "authenticated" });
      return UserId.safeParse(payload.sub).success ? { id: payload.sub as string, anonymous: payload.is_anonymous === true } : null;
    } catch {
      return null;
    }
  };
}
