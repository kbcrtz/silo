import type postgres from "postgres";

// Mirrors frontend/src/lib/measurements.ts MeasurementType.
export const MEASUREMENT_TYPES = ["height", "weight", "chest", "bust", "waist", "hips", "inseam", "armLength"] as const;
export type Measurement = { type: (typeof MEASUREMENT_TYPES)[number]; value: number; measuredAt: string };

/**
 * A signed-in user's data, per Supabase user id: the profile and saved items
 * as JSON snapshots, measurements as a time series. Tables are in
 * supabase/migrations; deleting the account deletes these rows.
 * The selfie is kept only as the compacted passport photo.
 */
export type UserData = {
  get(userId: string): Promise<{ profile: unknown; saved: unknown; measurements: Measurement[] }>;
  putProfile(userId: string, data: Record<string, unknown>): Promise<void>;
  putSaved(userId: string, data: Record<string, unknown>): Promise<void>;
  getPhoto(userId: string): Promise<{ image: Buffer; updatedAt: Date } | null>;
  /** Replaces the user's photo (already compacted). */
  putPhoto(userId: string, image: Buffer): Promise<void>;
  /** Returns how many were new; resending the same entry is a no-op. */
  addMeasurements(userId: string, entries: Measurement[]): Promise<number>;
  /**
   * Moves an anonymous user's data into an Apple/Google account they signed in
   * to: measurements join the history, the newer profile and photo win, the account's
   * own saved items win, events move. Leaves the anonymous user empty.
   */
  merge(fromUserId: string, toUserId: string): Promise<void>;
};

export function createUserData(sql: postgres.Sql): UserData {
  const json = (data: Record<string, unknown>) => sql.json(data as postgres.JSONValue);
  return {
    async get(userId) {
      const [profile] = await sql<{ data: unknown }[]>`SELECT data FROM profiles WHERE user_id = ${userId}`;
      const [saved] = await sql<{ data: unknown }[]>`SELECT data FROM saved WHERE user_id = ${userId}`;
      // The newest 1000, oldest first: the app reads the latest of each type.
      const rows = await sql<{ type: Measurement["type"]; value: number; measured_at: Date }[]>`
        SELECT type, value, measured_at FROM measurements WHERE user_id = ${userId} ORDER BY measured_at DESC LIMIT 1000`;
      return {
        profile: profile?.data ?? null,
        saved: saved?.data ?? null,
        measurements: rows.reverse().map((r) => ({ type: r.type, value: r.value, measuredAt: r.measured_at.toISOString() })),
      };
    },
    async putProfile(userId, data) {
      await sql`INSERT INTO profiles (user_id, data) VALUES (${userId}, ${json(data)})
        ON CONFLICT (user_id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`;
    },
    async putSaved(userId, data) {
      await sql`INSERT INTO saved (user_id, data) VALUES (${userId}, ${json(data)})
        ON CONFLICT (user_id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`;
    },
    async getPhoto(userId) {
      const [row] = await sql<{ image: Buffer; updated_at: Date }[]>`SELECT image, updated_at FROM profile_photos WHERE user_id = ${userId}`;
      return row ? { image: row.image, updatedAt: row.updated_at } : null;
    },
    async putPhoto(userId, image) {
      await sql`INSERT INTO profile_photos (user_id, image) VALUES (${userId}, ${image})
        ON CONFLICT (user_id) DO UPDATE SET image = EXCLUDED.image, updated_at = now()`;
    },
    async merge(from, to) {
      await sql.begin(async (tx) => {
        await tx`INSERT INTO measurements (user_id, type, value, measured_at)
          SELECT ${to}, type, value, measured_at FROM measurements WHERE user_id = ${from} ON CONFLICT DO NOTHING`;
        await tx`INSERT INTO profiles (user_id, data, updated_at) SELECT ${to}, data, updated_at FROM profiles WHERE user_id = ${from}
          ON CONFLICT (user_id) DO UPDATE SET data = EXCLUDED.data, updated_at = EXCLUDED.updated_at WHERE profiles.updated_at < EXCLUDED.updated_at`;
        await tx`INSERT INTO profile_photos (user_id, image, updated_at) SELECT ${to}, image, updated_at FROM profile_photos WHERE user_id = ${from}
          ON CONFLICT (user_id) DO UPDATE SET image = EXCLUDED.image, updated_at = EXCLUDED.updated_at WHERE profile_photos.updated_at < EXCLUDED.updated_at`;
        await tx`INSERT INTO saved (user_id, data, updated_at) SELECT ${to}, data, updated_at FROM saved WHERE user_id = ${from} ON CONFLICT (user_id) DO NOTHING`;
        await tx`UPDATE events SET user_id = ${to} WHERE user_id = ${from}`;
        for (const table of ["measurements", "profiles", "saved", "profile_photos"]) await tx`DELETE FROM ${tx(table)} WHERE user_id = ${from}`;
      });
    },
    async addMeasurements(userId, entries) {
      if (!entries.length) return 0;
      const rows = entries.map((e) => ({ user_id: userId, type: e.type, value: e.value, measured_at: e.measuredAt }));
      const inserted = await sql`INSERT INTO measurements ${sql(rows, "user_id", "type", "value", "measured_at")}
        ON CONFLICT DO NOTHING RETURNING 1`;
      return inserted.length;
    },
  };
}
