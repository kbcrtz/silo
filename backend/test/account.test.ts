import assert from "node:assert/strict";
import { test } from "node:test";
import { supabaseAccounts } from "../src/services/account.ts";

const USER = "6f1d2c3b-4a5e-4f60-8a7b-9c0d1e2f3a4b";

function fakeFetch(status: number) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url: String(url), init });
    return new Response(null, { status });
  }) as typeof globalThis.fetch;
  return { calls, fetch };
}

test("deleting an account calls Supabase's admin API for that user, with the secret key", async () => {
  const { calls, fetch } = fakeFetch(200);
  await supabaseAccounts({ url: "http://127.0.0.1:54321", secretKey: "sb_secret_test", fetch })(USER);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, `http://127.0.0.1:54321/auth/v1/admin/users/${USER}`);
  assert.equal(calls[0].init.method, "DELETE");
  assert.equal((calls[0].init.headers as Record<string, string>).apikey, "sb_secret_test");
});

test("an account that is already gone counts as deleted", async () => {
  await supabaseAccounts({ url: "http://x", secretKey: "k", fetch: fakeFetch(404).fetch })(USER);
});

test("any other failure is reported, so the app can say deletion didn't happen", async () => {
  await assert.rejects(supabaseAccounts({ url: "http://x", secretKey: "k", fetch: fakeFetch(500).fetch })(USER), { code: "account_delete_failed" });
});
