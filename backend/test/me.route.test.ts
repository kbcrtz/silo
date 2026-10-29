import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Writable } from "node:stream";
import { test } from "node:test";
import sharp from "sharp";
import { loadRules } from "../src/analysis/evaluate.ts";
import { buildApp } from "../src/app.ts";
import { createGate } from "../src/guard.ts";
import type { DeleteAccount } from "../src/services/account.ts";
import type { RevokeApple } from "../src/services/appleRevoke.ts";
import type { Measurement, UserData } from "../src/services/userData.ts";
import { ANON_TOKEN, ANON_USER, TOKEN, USER, verify } from "./fixtures/auth.ts";

const rules = loadRules(JSON.parse(readFileSync(new URL("../rules/color-analysis.v1.json", import.meta.url), "utf8")));
const SECRET = "test-secret-0123456789";

/** An in-memory UserData, so routes are tested without a database. */
function fakeData() {
  const profiles = new Map<string, unknown>();
  const saved = new Map<string, unknown>();
  const measurements = new Map<string, Measurement[]>();
  const photos = new Map<string, { image: Buffer; updatedAt: Date }>();
  let clock = Date.parse("2026-10-28T10:00:00Z");
  const data: UserData = {
    async get(user) {
      return { profile: profiles.get(user) ?? null, saved: saved.get(user) ?? null, measurements: measurements.get(user) ?? [] };
    },
    async putProfile(user, value) {
      profiles.set(user, value);
    },
    async putSaved(user, value) {
      saved.set(user, value);
    },
    async addMeasurements(user, entries) {
      const list = measurements.get(user) ?? [];
      const fresh = entries.filter((e) => !list.some((m) => m.type === e.type && m.measuredAt === e.measuredAt));
      measurements.set(user, [...list, ...fresh]);
      return fresh.length;
    },
    async getPhoto(user) {
      return photos.get(user) ?? null;
    },
    async putPhoto(user, image) {
      photos.set(user, { image, updatedAt: new Date((clock += 1000)) });
    },
    async merge(from, to) {
      merges.push([from, to]);
      if (photos.has(from)) photos.set(to, photos.get(from)!);
      await data.addMeasurements(to, measurements.get(from) ?? []);
      if (profiles.has(from)) profiles.set(to, profiles.get(from)); // the newer one; the anonymous profile is from just now
      if (!saved.has(to) && saved.has(from)) saved.set(to, saved.get(from));
      for (const m of [profiles, saved, measurements, photos]) m.delete(from);
    },
  };
  const merges: [string, string][] = [];
  return Object.assign(data, { merges });
}

function setup(
  userData: UserData | null = fakeData(),
  deleteAccount?: DeleteAccount,
  opts: { allowAnonymous?: boolean; revokeApple?: RevokeApple } = {},
) {
  const logs: any[] = [];
  const stream = new Writable({
    write(chunk, _enc, done) {
      for (const line of String(chunk).split("\n").filter(Boolean)) logs.push(JSON.parse(line));
      done();
    },
  });
  const catalog = { search: async () => assert.fail("no catalog"), getProduct: async () => assert.fail("no catalog") };
  const app = buildApp({
    rules,
    model: "m",
    logger: { level: "info", stream },
    locate: async () => assert.fail("no Gemini"),
    catalog,
    secret: SECRET,
    verify,
    gate: createGate({ windowMs: 60_000, max: 100, concurrency: 4 }),
    userData: userData ?? undefined,
    deleteAccount,
    allowAnonymous: opts.allowAnonymous ?? true,
    revokeApple: opts.revokeApple,
  });
  const call = (method: "GET" | "PUT" | "POST" | "DELETE", url: string, payload?: unknown, token: string | null = TOKEN) =>
    app.inject({
      method,
      url,
      payload: payload as never,
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });
  const putPhoto = async (file: Buffer, token = TOKEN, field = "photo") => {
    const form = new FormData();
    form.append(field, new Blob([new Uint8Array(file)], { type: "image/jpeg" }), "selfie.jpg");
    const req = new Request("http://local/", { method: "PUT", body: form });
    const payload = Buffer.from(await req.arrayBuffer());
    return app.inject({ method: "PUT", url: "/me/photo", payload, headers: { authorization: `Bearer ${token}`, "content-type": req.headers.get("content-type")! } });
  };
  const getPhoto = (token = TOKEN, etag?: string) =>
    app.inject({ method: "GET", url: "/me/photo", headers: { authorization: `Bearer ${token}`, ...(etag && { "if-none-match": etag }) } });
  return { call, logs, putPhoto, getPhoto };
}

const profile = { onboarded: true, shopFor: "womens", colorProfile: { seasonId: "soft-autumn" }, unitSystem: "imperial" };

test("a signed-in user's profile, saved items and measurements round-trip", async () => {
  const { call } = setup();
  assert.equal((await call("PUT", "/me/profile", { data: profile })).statusCode, 204);
  assert.equal((await call("PUT", "/me/saved", { data: { itemIds: ["w-01"], lists: [], items: {} } })).statusCode, 204);
  const added = await call("POST", "/me/measurements", {
    entries: [
      { type: "waist", value: 72, measuredAt: "2026-10-18T10:00:00.000Z" },
      { type: "inseam", value: 78, measuredAt: "2026-10-18T10:00:00.000Z" },
    ],
  });
  assert.deepEqual(added.json(), { added: 2 });
  const me = (await call("GET", "/me")).json();
  assert.deepEqual(me.profile, profile);
  assert.deepEqual(me.saved.itemIds, ["w-01"]);
  assert.equal(me.measurements.length, 2);
});

test("resending measurements adds nothing twice", async () => {
  const { call } = setup();
  const entries = [{ type: "waist", value: 72, measuredAt: "2026-10-18T10:00:00.000Z" }];
  await call("POST", "/me/measurements", { entries });
  assert.deepEqual((await call("POST", "/me/measurements", { entries })).json(), { added: 0 });
});

test("a new account starts empty", async () => {
  const me = (await setup().call("GET", "/me")).json();
  assert.deepEqual(me, { profile: null, saved: null, measurements: [] });
});

test("the data routes need a signed-in user", async () => {
  const { call } = setup();
  for (const [method, url] of [["GET", "/me"], ["PUT", "/me/profile"], ["POST", "/me/measurements"], ["DELETE", "/me"], ["POST", "/events"]] as const) {
    const res = await call(method, url, {}, null);
    assert.equal(res.statusCode, 401, url);
    assert.deepEqual(res.json(), { error: "unauthorized" });
  }
  assert.equal((await call("GET", "/me", undefined, "someone-elses-token")).statusCode, 401);
});

test("bad bodies are rejected before the database", async () => {
  const { call } = setup();
  for (const [url, payload] of [
    ["/me/profile", { data: "nope" }],
    ["/me/profile", { data: { a: "x".repeat(40_000) } }],
    ["/me/measurements", { entries: [{ type: "shoe", value: 9, measuredAt: "2026-10-18T10:00:00.000Z" }] }],
    ["/me/measurements", { entries: [{ type: "waist", value: -3, measuredAt: "2026-10-18T10:00:00.000Z" }] }],
    ["/me/measurements", { entries: [{ type: "waist", value: 70, measuredAt: "yesterday" }] }],
  ] as const) {
    const res = await call(url === "/me/profile" ? "PUT" : "POST", url, payload);
    assert.ok([400, 413].includes(res.statusCode), `${url} ${res.statusCode}`);
  }
});

test("without a database the routes say so instead of failing silently", async () => {
  const res = await setup(null).call("GET", "/me");
  assert.equal(res.statusCode, 503);
  assert.deepEqual(res.json(), { error: "data_unavailable" });
});

test("logs carry counts, never measurements or profile contents", async () => {
  const { call, logs } = setup();
  await call("PUT", "/me/profile", { data: profile });
  await call("POST", "/me/measurements", { entries: [{ type: "waist", value: 72.5, measuredAt: "2026-10-18T10:00:00.000Z" }] });
  const all = JSON.stringify(logs);
  assert.ok(logs.some((l) => l.userData?.route === "measurements" && l.userData.added === 1));
  assert.ok(!all.includes("72.5") && !all.includes("soft-autumn") && !all.includes(USER), "log leaked user data");
});

test("bust is a measurement the app records, so it backs up too", async () => {
  const { call } = setup();
  const res = await call("POST", "/me/measurements", { entries: [{ type: "bust", value: 90, measuredAt: "2026-10-18T10:00:00.000Z" }] });
  assert.deepEqual(res.json(), { added: 1 });
});

test("measurement dates outside 2000..tomorrow are rejected", async () => {
  const { call } = setup();
  for (const measuredAt of ["1999-12-31T00:00:00.000Z", "9999-01-01T00:00:00.000Z", new Date(Date.now() + 3 * 86_400_000).toISOString()]) {
    const res = await call("POST", "/me/measurements", { entries: [{ type: "waist", value: 70, measuredAt }] });
    assert.equal(res.statusCode, 400, measuredAt);
  }
});

test("DELETE /me deletes the signed-in user's account", async () => {
  const deleted: string[] = [];
  const { call } = setup(fakeData(), async (user) => void deleted.push(user));
  assert.equal((await call("DELETE", "/me")).statusCode, 204);
  assert.deepEqual(deleted, [USER]);
});

test("without account deletion configured, DELETE /me says so", async () => {
  const res = await setup().call("DELETE", "/me");
  assert.equal(res.statusCode, 503);
  assert.deepEqual(res.json(), { error: "account_delete_unavailable" });
});

test("framework errors use the same { error } shape", async () => {
  const { call } = setup();
  assert.deepEqual((await call("GET", "/nope")).json(), { error: "not_found" });
});

test("signing in with Apple/Google to an existing account takes over the anonymous user's data", async () => {
  const data = fakeData();
  const deleted: string[] = [];
  const { call } = setup(data, async (user) => void deleted.push(user));
  await call("PUT", "/me/profile", { data: profile }, ANON_TOKEN);
  await call("POST", "/me/measurements", { entries: [{ type: "waist", value: 72, measuredAt: "2026-10-18T10:00:00.000Z" }] }, ANON_TOKEN);
  await call("PUT", "/me/saved", { data: { itemIds: ["mine-already"] } });
  const res = await call("POST", "/me/merge", { anonymousToken: ANON_TOKEN });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(data.merges, [[ANON_USER, USER]]);
  assert.deepEqual(deleted, [ANON_USER], "the emptied anonymous user is deleted");
  const me = res.json();
  assert.deepEqual(me.profile, profile);
  assert.deepEqual(me.saved, { itemIds: ["mine-already"] }, "the account's own saved items win");
  assert.equal(me.measurements.length, 1);
});

const selfie = () => sharp({ create: { width: 1200, height: 1600, channels: 3, background: { r: 200, g: 150, b: 120 } } }).jpeg().toBuffer();

test("the profile photo is stored compacted and comes back; an unchanged copy isn't sent again", async () => {
  const { putPhoto, getPhoto } = setup();
  assert.deepEqual((await getPhoto()).json(), { error: "no_photo" });
  assert.equal((await putPhoto(await selfie())).statusCode, 204);
  const res = await getPhoto();
  assert.equal(res.statusCode, 200);
  assert.equal(res.headers["content-type"], "image/jpeg");
  assert.equal((await sharp(res.rawPayload).metadata()).height, 480);
  const etag = String(res.headers.etag);
  assert.equal((await getPhoto(TOKEN, etag)).statusCode, 304);
  await putPhoto(await selfie()); // changing it
  assert.equal((await getPhoto(TOKEN, etag)).statusCode, 200);
});

test("photo uploads need the photo field and a real image", async () => {
  const { putPhoto } = setup();
  assert.deepEqual((await putPhoto(await selfie(), TOKEN, "selfie")).json(), { error: "missing_photo" });
  assert.equal((await putPhoto(Buffer.from("not a photo"))).statusCode, 415);
});

test("the anonymous user's photo moves into the account on merge", async () => {
  const data = fakeData();
  const { putPhoto, getPhoto, call } = setup(data, async () => {});
  await putPhoto(await selfie(), ANON_TOKEN);
  await call("POST", "/me/merge", { anonymousToken: ANON_TOKEN });
  assert.equal((await getPhoto()).statusCode, 200);
});

test("a merge only takes a genuine anonymous login, into a real Apple/Google account", async () => {
  const data = fakeData();
  const { call } = setup(data, async () => {});
  for (const [token, body] of [
    [TOKEN, { anonymousToken: TOKEN }], // not anonymous: someone else's real account
    [TOKEN, { anonymousToken: "forged" }],
    [TOKEN, {}],
    [ANON_TOKEN, { anonymousToken: ANON_TOKEN }], // the caller must be the Apple/Google account
  ] as const) {
    const res = await call("POST", "/me/merge", body, token);
    assert.equal(res.statusCode, 400, JSON.stringify(body));
    assert.deepEqual(res.json(), { error: "invalid_merge" });
  }
  assert.equal(data.merges.length, 0);
});

test("deleting an Apple account revokes its Apple token first, then deletes", async () => {
  const steps: string[] = [];
  const { call } = setup(fakeData(), async () => void steps.push("delete"), { revokeApple: async (code) => void steps.push(`revoke:${code}`) });
  assert.equal((await call("DELETE", "/me", { appleAuthorizationCode: "c0de" })).statusCode, 204);
  assert.deepEqual(steps, ["revoke:c0de", "delete"]);
});

test("a failed Apple revocation still deletes the account; without a code nothing is revoked", async () => {
  const steps: string[] = [];
  const { call, logs } = setup(fakeData(), async () => void steps.push("delete"), {
    revokeApple: async () => Promise.reject(new Error("apple down")),
  });
  assert.equal((await call("DELETE", "/me", { appleAuthorizationCode: "c0de" })).statusCode, 204);
  assert.equal((await call("DELETE", "/me")).statusCode, 204);
  assert.deepEqual(steps, ["delete", "delete"]);
  assert.ok(logs.some((l) => l.userData?.appleRevoked === false));
});
