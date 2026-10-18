import type postgres from "postgres";

export const MEASUREMENT_TYPES = ["height", "weight", "chest", "waist", "hips", "inseam", "armLength"] as const;
export type Measurement = { type: (typeof MEASUREMENT_TYPES)[number]; value: number; measuredAt: string };

/**
 * What the app keeps on the phone, backed up per anonymous device id: the
 * profile and saved items as JSON snapshots, measurements as a time series.
 * Selfie photos never leave the phone.
 */
export type UserData = {
  get(deviceId: string): Promise<{ profile: unknown; saved: unknown; measurements: Measurement[] }>;
  putProfile(deviceId: string, data: Record<string, unknown>): Promise<void>;
  putSaved(deviceId: string, data: Record<string, unknown>): Promise<void>;
  /** Returns how many were new; resending the same entry is a no-op. */
  addMeasurements(deviceId: string, entries: Measurement[]): Promise<number>;
};

/** Creates the tables if missing. Measurements are a TimescaleDB hypertable on measured_at. */
export async function migrate(sql: postgres.Sql) {
  await sql`CREATE TABLE IF NOT EXISTS profiles (
    device_id uuid PRIMARY KEY,
    data jsonb NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS saved (
    device_id uuid PRIMARY KEY,
    data jsonb NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS measurements (
    device_id uuid NOT NULL,
    type text NOT NULL,
    value double precision NOT NULL,
    measured_at timestamptz NOT NULL,
    PRIMARY KEY (device_id, type, measured_at)
  )`;
  await sql`SELECT create_hypertable('measurements', by_range('measured_at'), if_not_exists => TRUE)`;
}

export function createUserData(sql: postgres.Sql): UserData {
  const json = (data: Record<string, unknown>) => sql.json(data as postgres.JSONValue);
  return {
    async get(deviceId) {
      const [profile] = await sql<{ data: unknown }[]>`SELECT data FROM profiles WHERE device_id = ${deviceId}`;
      const [saved] = await sql<{ data: unknown }[]>`SELECT data FROM saved WHERE device_id = ${deviceId}`;
      const rows = await sql<{ type: Measurement["type"]; value: number; measured_at: Date }[]>`
        SELECT type, value, measured_at FROM measurements WHERE device_id = ${deviceId} ORDER BY measured_at LIMIT 1000`;
      return {
        profile: profile?.data ?? null,
        saved: saved?.data ?? null,
        measurements: rows.map((r) => ({ type: r.type, value: r.value, measuredAt: r.measured_at.toISOString() })),
      };
    },
    async putProfile(deviceId, data) {
      await sql`INSERT INTO profiles (device_id, data) VALUES (${deviceId}, ${json(data)})
        ON CONFLICT (device_id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`;
    },
    async putSaved(deviceId, data) {
      await sql`INSERT INTO saved (device_id, data) VALUES (${deviceId}, ${json(data)})
        ON CONFLICT (device_id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`;
    },
    async addMeasurements(deviceId, entries) {
      if (!entries.length) return 0;
      const rows = entries.map((e) => ({ device_id: deviceId, type: e.type, value: e.value, measured_at: e.measuredAt }));
      const inserted = await sql`INSERT INTO measurements ${sql(rows, "device_id", "type", "value", "measured_at")}
        ON CONFLICT DO NOTHING RETURNING 1`;
      return inserted.length;
    },
  };
}
