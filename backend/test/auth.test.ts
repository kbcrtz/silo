import assert from "node:assert/strict";
import { test } from "node:test";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import { supabaseVerifier } from "../src/auth.ts";

const ISSUER = "http://127.0.0.1:54321/auth/v1";
const USER = "6f1d2c3b-4a5e-4f60-8a7b-9c0d1e2f3a4b";
const { publicKey, privateKey } = await generateKeyPair("ES256");
const other = await generateKeyPair("ES256");
const jwks = createLocalJWKSet({ keys: [{ ...(await exportJWK(publicKey)), kid: "k1", alg: "ES256" }] });
const verify = supabaseVerifier({ issuer: ISSUER, keys: jwks });

/** A token shaped like Supabase Auth's access tokens. */
function token(claims: Record<string, unknown> = {}, opts: { key?: CryptoKey; issuer?: string; audience?: string; expires?: string } = {}) {
  return new SignJWT({ role: "authenticated", is_anonymous: false, ...claims })
    .setProtectedHeader({ alg: "ES256", kid: "k1" })
    .setSubject(USER)
    .setIssuer(opts.issuer ?? ISSUER)
    .setAudience(opts.audience ?? "authenticated")
    .setIssuedAt()
    .setExpirationTime(opts.expires ?? "1h")
    .sign(opts.key ?? privateKey);
}

test("a Supabase access token signed by the project's key gives its user id", async () => {
  assert.deepEqual(await verify(await token()), { id: USER, anonymous: false });
});

test("tokens from another key, issuer or audience, or expired, are refused", async () => {
  assert.equal(await verify(await token({}, { key: other.privateKey })), null);
  assert.equal(await verify(await token({}, { issuer: "https://other.supabase.co/auth/v1" })), null);
  assert.equal(await verify(await token({}, { audience: "anon" })), null);
  assert.equal(await verify(await token({}, { expires: "-1m" })), null);
  assert.equal(await verify("not-a-jwt"), null);
});

test("anonymous Supabase users are recognized as such; the app decides whether they count", async () => {
  assert.deepEqual(await verify(await token({ is_anonymous: true })), { id: USER, anonymous: true });
});

test("a token whose subject isn't a user id is refused", async () => {
  const bad = await new SignJWT({ role: "authenticated" })
    .setProtectedHeader({ alg: "ES256", kid: "k1" })
    .setSubject("service")
    .setIssuer(ISSUER)
    .setAudience("authenticated")
    .setExpirationTime("1h")
    .sign(privateKey);
  assert.equal(await verify(bad), null);
});
