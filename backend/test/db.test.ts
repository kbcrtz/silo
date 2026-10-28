import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import postgres from "postgres";
import { createTrends } from "../src/services/trends.ts";
import { postgresStore } from "../src/services/tryOnImage.ts";
import { createUserData } from "../src/services/userData.ts";

/**
 * Runs the data services against a real Supabase database with the
 * migrations applied, e.g. the local stack from `supabase start`:
 * TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres npm test
 * Skipped without it. Creates throwaway auth users and deletes them.
 */
const url = process.env.TEST_DATABASE_URL;
const sql = url ? postgres(url, { max: 2, onnotice: () => {} }) : null;
const users: string[] = [];

async function newUser() {
  const id = randomUUID();
  await sql!`INSERT INTO auth.users (id, aud, role, email) VALUES (${id}, 'authenticated', 'authenticated', ${`${id}@test.local`})`;
  users.push(id);
  return id;
}

after(async () => {
  if (!sql) return;
  if (users.length) await sql`DELETE FROM auth.users WHERE id IN ${sql(users)}`;
  await sql.end();
});

test("profile, saved items and measurements round-trip per user", { skip: !sql }, async () => {
  const data = createUserData(sql!);
  const [me, other] = [await newUser(), await newUser()];
  await data.putProfile(me, { shopFor: "womens" });
  await data.putProfile(me, { shopFor: "mens" });
  await data.putSaved(me, { itemIds: ["w-01"] });
  const entry = { type: "waist" as const, value: 72, measuredAt: "2026-10-18T10:00:00.000Z" };
  assert.equal(await data.addMeasurements(me, [entry, { ...entry, type: "hips", value: 98 }]), 2);
  assert.equal(await data.addMeasurements(me, [entry]), 0, "resending is a no-op");
  const got = await data.get(me);
  assert.deepEqual(got.profile, { shopFor: "mens" });
  assert.deepEqual(got.saved, { itemIds: ["w-01"] });
  assert.equal(got.measurements.length, 2);
  assert.deepEqual(await data.get(other), { profile: null, saved: null, measurements: [] });
});

test("popular this week: each user's strongest action per item, per season, straight from events", { skip: !sql }, async () => {
  const trends = createTrends(sql!);
  const season = `test-${randomUUID().slice(0, 8)}`;
  const [me, other] = [await newUser(), await newUser()];
  await trends.record(me, [
    { kind: "shop", itemId: "shopify-HOT", season, garment: "top", silhouette: "relaxed", family: "Green" },
    { kind: "shop", itemId: "shopify-SOLO", season },
    { kind: "shop", itemId: "shopify-SOLO", season },
    { kind: "open", itemId: "shopify-MEH", season },
  ]);
  await trends.record(other, [{ kind: "save", itemId: "shopify-HOT", season }, { kind: "open", itemId: "shopify-MEH", season }]);
  const t = await trends.trending(season);
  assert.deepEqual(t.items, ["shopify-HOT"]); // two users, 5 + 3; SOLO has one user, MEH 2 points
  assert.deepEqual(await trends.trending("some-other-season"), { items: [], traits: [] });
});

test("deleting the account deletes its data and anonymizes its events", { skip: !sql }, async () => {
  const data = createUserData(sql!);
  const me = await newUser();
  await data.putProfile(me, { shopFor: "both" });
  await data.addMeasurements(me, [{ type: "height", value: 170, measuredAt: "2026-10-18T10:00:00.000Z" }]);
  const season = `test-${randomUUID().slice(0, 8)}`;
  await createTrends(sql!).record(me, [{ kind: "shop", itemId: "shopify-X", season }]);
  await sql!`DELETE FROM auth.users WHERE id = ${me}`;
  assert.deepEqual(await data.get(me), { profile: null, saved: null, measurements: [] });
  const [events] = await sql!<{ n: number; owned: number }[]>`
    SELECT count(*)::int AS n, count(user_id)::int AS owned FROM events WHERE season = ${season}`;
  assert.deepEqual(events, { n: 1, owned: 0 });
});

test("try-on images are saved and served by key", { skip: !sql }, async () => {
  const store = postgresStore(sql!);
  const key = `test|${randomUUID()}`;
  assert.equal(await store.get(key), null);
  await store.put(key, Buffer.from("jpeg"), "m");
  assert.equal((await store.get(key))?.toString(), "jpeg");
  await sql!`DELETE FROM tryon_images WHERE key = ${key}`;
});

test("merging an anonymous user into an Apple/Google account moves its data by the merge rules", { skip: !sql }, async () => {
  const data = createUserData(sql!);
  const [anon, account] = [await newUser(), await newUser()];
  const season = `test-${randomUUID().slice(0, 8)}`;
  await data.putProfile(account, { from: "account" });
  await data.putSaved(account, { itemIds: ["account-item"] });
  await data.addMeasurements(account, [{ type: "waist", value: 70, measuredAt: "2026-10-01T10:00:00.000Z" }]);
  await data.putProfile(anon, { from: "anonymous" }); // newer: just onboarded
  await data.putSaved(anon, { itemIds: ["anon-item"] });
  await data.addMeasurements(anon, [
    { type: "waist", value: 70, measuredAt: "2026-10-01T10:00:00.000Z" }, // same entry: kept once
    { type: "hips", value: 98, measuredAt: "2026-10-19T10:00:00.000Z" },
  ]);
  await createTrends(sql!).record(anon, [{ kind: "save", itemId: "shopify-M", season }]);

  await data.merge(anon, account);
  const got = await data.get(account);
  assert.deepEqual(got.profile, { from: "anonymous" }, "the newer profile wins");
  assert.deepEqual(got.saved, { itemIds: ["account-item"] }, "the account's saved items win");
  assert.deepEqual(got.measurements.map((m) => m.type).sort(), ["hips", "waist"]);
  assert.deepEqual(await data.get(anon), { profile: null, saved: null, measurements: [] });
  const [moved] = await sql!<{ owner: string }[]>`SELECT user_id::text AS owner FROM events WHERE season = ${season}`;
  assert.equal(moved.owner, account);
});
