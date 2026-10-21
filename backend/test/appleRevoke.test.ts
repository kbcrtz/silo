import assert from "node:assert/strict";
import { test } from "node:test";
import { exportPKCS8, generateKeyPair, jwtVerify } from "jose";
import { appleRevoker } from "../src/services/appleRevoke.ts";

const { publicKey, privateKey } = await generateKeyPair("ES256", { extractable: true });
const pem = await exportPKCS8(privateKey);

function fakeApple(opts: { tokenStatus?: number; revokeStatus?: number } = {}) {
  const calls: { url: string; form: URLSearchParams }[] = [];
  const fetch = (async (url: string, init: RequestInit) => {
    const form = new URLSearchParams(String(init.body));
    calls.push({ url: String(url), form });
    if (String(url).endsWith("/auth/token")) {
      return new Response(JSON.stringify({ refresh_token: "r-123", access_token: "a-123" }), { status: opts.tokenStatus ?? 200 });
    }
    return new Response(null, { status: opts.revokeStatus ?? 200 });
  }) as typeof globalThis.fetch;
  return { calls, fetch };
}

const revoker = (fetch: typeof globalThis.fetch) =>
  appleRevoker({ teamId: "TEAM123456", keyId: "KEY1234567", privateKey: pem, clientId: "com.siloapp.ios", fetch });

test("exchanges the authorization code with a signed client secret, then revokes the refresh token", async () => {
  const { calls, fetch } = fakeApple();
  await revoker(fetch)("auth-code");
  assert.deepEqual(calls.map((c) => c.url), ["https://appleid.apple.com/auth/token", "https://appleid.apple.com/auth/revoke"]);
  const [exchange, revoke] = calls;
  assert.equal(exchange.form.get("grant_type"), "authorization_code");
  assert.equal(exchange.form.get("code"), "auth-code");
  assert.equal(exchange.form.get("client_id"), "com.siloapp.ios");
  const { payload, protectedHeader } = await jwtVerify(exchange.form.get("client_secret")!, publicKey, { audience: "https://appleid.apple.com" });
  assert.equal(protectedHeader.kid, "KEY1234567");
  assert.equal(payload.iss, "TEAM123456");
  assert.equal(payload.sub, "com.siloapp.ios");
  assert.equal(revoke.form.get("token"), "r-123");
  assert.equal(revoke.form.get("token_type_hint"), "refresh_token");
});

test("Apple refusing either step is an error", async () => {
  await assert.rejects(revoker(fakeApple({ tokenStatus: 400 }).fetch)("bad-code"), { code: "apple_revoke_failed" });
  await assert.rejects(revoker(fakeApple({ revokeStatus: 500 }).fetch)("auth-code"), { code: "apple_revoke_failed" });
});
