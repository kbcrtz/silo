import type postgres from "postgres";

// Mirrors frontend/src/lib/measurements.ts MeasurementType.
export const MEASUREMENT_TYPES = ["height", "weight", "chest", "bust", "waist", "hips", "inseam", "armLength"] as const;
export type Measurement = { type: (typeof MEASUREMENT_TYPES)[number]; value: number; measuredAt: string };

/**
 * A signed-in user's data, per Supabase user id: the profile and saved items
 * as JSON snapshots, measurements as a time series. Tables are in
 * supabase/migrations; deleting the account deletes these rows.
 * Selfie photos never leave the phone.
 */
export type UserData = {
  get(userId: string): Promise<{ profile: unknown; saved: unknown; measurements: Measurement[] }>;
  putProfile(userId: string, data: Record<string, unknown>): Promise<void>;
  putSaved(userId: string, data: Record<string, unknown>): Promise<void>;
  /** Returns how many were new; resending the same entry is a no-op. */
  addMeasurements(userId: string, entries: Measurement[]): Promise<number>;
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
    async addMeasurements(userId, entries) {
      if (!entries.length) return 0;
      const rows = entries.map((e) => ({ user_id: userId, type: e.type, value: e.value, measured_at: e.measuredAt }));
      const inserted = await sql`INSERT INTO measurements ${sql(rows, "user_id", "type", "value", "measured_at")}
        ON CONFLICT DO NOTHING RETURNING 1`;
      return inserted.length;
    },
  };
}
