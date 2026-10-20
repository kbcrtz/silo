import { jwtVerify, type JWTVerifyGetKey } from "jose";
import { z } from "zod";

/** A login token's user id, or null when it isn't a valid signed-in Supabase session. */
export type Verify = (token: string) => Promise<string | null>;

const UserId = z.uuid();

/**
 * Checks Supabase Auth access tokens locally against the project's public
 * signing keys (its JWKS), so no request waits on Supabase.
 * shortcut: anonymous Supabase users count as signed in, so TestFlight builds work before Apple/Google sign-in ships;
 * refuse `payload.is_anonymous` here once it does.
 */
export function supabaseVerifier({ issuer, keys }: { issuer: string; keys: JWTVerifyGetKey }): Verify {
  return async (token) => {
    try {
      const { payload } = await jwtVerify(token, keys, { issuer, audience: "authenticated" });
      return UserId.safeParse(payload.sub).success ? (payload.sub as string) : null;
    } catch {
      return null;
    }
  };
}
