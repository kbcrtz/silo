import assert from "node:assert/strict";
import { test } from "node:test";
import { revenueCatMembership } from "../src/services/membership.ts";

const day = 24 * 60 * 60 * 1000;
const iso = (offset: number) => new Date(Date.now() + offset).toISOString();

function fakeRevenueCat(entitlements: Record<string, unknown> | null, status = 200) {
  const calls: { url: string; auth: string | null }[] = [];
  const fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url: String(url), auth: new Headers(init.headers).get("authorization") });
    return new Response(JSON.stringify({ subscriber: { entitlements: entitlements ?? {} } }), { status });
  }) as typeof globalThis.fetch;
  return { calls, fetch, check: revenueCatMembership({ secretKey: "sk_test", fetch }) };
}

test("asks RevenueCat about the Supabase user with the secret key", async () => {
  const { calls, check } = fakeRevenueCat({ member: { expires_date: iso(day) } });
  assert.equal(await check("user-1"), true);
  assert.equal(calls[0].url, "https://api.revenuecat.com/v1/subscribers/user-1");
  assert.equal(calls[0].auth, "Bearer sk_test");
});

test("an expired, missing or other entitlement isn't a membership; a grace period or lifetime one is", async () => {
  assert.equal(await fakeRevenueCat({ member: { expires_date: iso(-day) } }).check("u"), false);
  assert.equal(await fakeRevenueCat({}).check("u"), false);
  assert.equal(await fakeRevenueCat({ other: { expires_date: iso(day) } }).check("u"), false);
  assert.equal(await fakeRevenueCat({ member: { expires_date: iso(-day), grace_period_expires_date: iso(day) } }).check("u"), true);
  assert.equal(await fakeRevenueCat({ member: { expires_date: null } }).check("u"), true);
});

test("an answer is reused for a while instead of asking on every request", async () => {
  const { calls, check } = fakeRevenueCat({ member: { expires_date: iso(day) } });
  await check("user-1");
  await check("user-1");
  assert.equal(calls.length, 1);
});

test("when RevenueCat can't answer, the check says so instead of guessing", async () => {
  assert.equal(await fakeRevenueCat(null, 500).check("u"), null);
});

test("requests at the same moment share one question to RevenueCat", async () => {
  const { calls, check } = fakeRevenueCat({ member: { expires_date: iso(day) } });
  assert.deepEqual(await Promise.all([check("user-1"), check("user-1"), check("user-1")]), [true, true, true]);
  assert.equal(calls.length, 1);
});

test("a no is asked again next time, so a renewal gets in at once", async () => {
  const { calls, check } = fakeRevenueCat({});
  await check("user-1");
  await check("user-1");
  assert.equal(calls.length, 2);
});

test("an outage is remembered briefly, so every request doesn't wait out the timeout", async () => {
  const { calls, check } = fakeRevenueCat(null, 503);
  assert.equal(await check("user-1"), null);
  assert.equal(await check("user-1"), null);
  assert.equal(calls.length, 1);
});
