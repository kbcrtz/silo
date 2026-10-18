import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { HttpError } from "../errors.ts";
import { MEASUREMENT_TYPES, type UserData } from "../services/userData.ts";

const PROFILE_LIMIT = 32 * 1024;
const SAVED_LIMIT = 256 * 1024;

const Snapshot = z.object({ data: z.record(z.string(), z.unknown()) });
const Measurements = z.object({
  entries: z
    .array(z.object({ type: z.enum(MEASUREMENT_TYPES), value: z.number().positive().max(1000), measuredAt: z.iso.datetime() }))
    .max(500),
});
const DeviceId = z.uuid();

/**
 * The app's on-device data, backed up to Postgres (Tiger Cloud) per anonymous
 * device id sent as x-device-id: GET /me, PUT /me/profile, PUT /me/saved,
 * POST /me/measurements. Selfie photos stay on the phone.
 */
export async function meRoute(app: FastifyInstance, { userData }: { userData?: UserData }) {
  async function handle(route: string, req: FastifyRequest, reply: FastifyReply, run: (data: UserData, device: string, diag: Record<string, unknown>) => Promise<unknown>) {
    // Counts only: no device ids, measurements or profile contents.
    const diag: Record<string, unknown> = { route };
    try {
      if (!userData) throw new HttpError("data_unavailable", 503);
      const device = DeviceId.safeParse(req.headers["x-device-id"]);
      if (!device.success) throw new HttpError("invalid_device", 400);
      const result = await run(userData, device.data, diag);
      return result === undefined ? reply.code(204).send() : result;
    } catch (e) {
      const known = e instanceof HttpError ? e : null;
      if (!known) req.log.error({ errorName: (e as Error).name }, "user_data_unexpected");
      const err = known ?? new HttpError("data_failed", 502);
      diag.error = err.code;
      return reply.code(err.status).send({ error: err.code });
    } finally {
      req.log.info({ userData: diag }, "user_data");
    }
  }

  const snapshot = (body: unknown, limit: number) => {
    const parsed = Snapshot.safeParse(body);
    if (!parsed.success) throw new HttpError("invalid_request", 400);
    if (JSON.stringify(parsed.data.data).length > limit) throw new HttpError("too_large", 413);
    return parsed.data.data;
  };

  app.get("/me", (req, reply) =>
    handle("get", req, reply, async (data, device, diag) => {
      const me = await data.get(device);
      diag.measurements = me.measurements.length;
      return me;
    }),
  );

  app.put("/me/profile", (req, reply) =>
    handle("profile", req, reply, async (data, device) => {
      await data.putProfile(device, snapshot(req.body, PROFILE_LIMIT));
    }),
  );

  app.put("/me/saved", (req, reply) =>
    handle("saved", req, reply, async (data, device) => {
      await data.putSaved(device, snapshot(req.body, SAVED_LIMIT));
    }),
  );

  app.post("/me/measurements", (req, reply) =>
    handle("measurements", req, reply, async (data, device, diag) => {
      const parsed = Measurements.safeParse(req.body);
      if (!parsed.success) throw new HttpError("invalid_request", 400);
      const added = await data.addMeasurements(device, parsed.data.entries);
      diag.added = added;
      return { added };
    }),
  );
}
