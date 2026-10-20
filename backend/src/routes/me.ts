import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { HttpError } from "../errors.ts";
import type { DeleteAccount } from "../services/account.ts";
import { GARMENTS, SILHOUETTES } from "../services/listingInsights.ts";
import { EVENT_KINDS, familyOfHex, type Trends } from "../services/trends.ts";
import { MEASUREMENT_TYPES, type UserData } from "../services/userData.ts";

const PROFILE_LIMIT = 32 * 1024;
const SAVED_LIMIT = 256 * 1024;

const Snapshot = z.object({ data: z.record(z.string(), z.unknown()) });
const Measurements = z.object({
  entries: z
    .array(
      z.object({
        type: z.enum(MEASUREMENT_TYPES),
        value: z.number().positive().max(1000),
        measuredAt: z.iso.datetime().refine((at) => at >= "2000-01-01" && Date.parse(at) < Date.now() + 86_400_000),
      }),
    )
    .max(500),
});
const Events = z.object({
  events: z
    .array(
      z.object({
        kind: z.enum(EVENT_KINDS),
        itemId: z.string().min(1).max(80),
        season: z
          .string()
          .regex(/^[a-z-]{3,24}$/)
          .optional(),
        garment: z.enum(GARMENTS).optional(),
        silhouette: z.enum(SILHOUETTES).optional(),
        color: z
          .string()
          .regex(/^#[0-9a-f]{6}$/i)
          .optional(),
      }),
    )
    .min(1)
    .max(100),
});

/**
 * The signed-in user's data in Postgres, moved there from the phone after
 * sign-up: GET /me, PUT /me/profile, PUT /me/saved, POST /me/measurements,
 * POST /events, and DELETE /me (deletes the account). Selfie photos stay on the phone.
 * The app's onRequest hook has already checked the login, so req.userId is set.
 */
export async function meRoute(
  app: FastifyInstance,
  { userData, trends, deleteAccount }: { userData?: UserData; trends?: Trends; deleteAccount?: DeleteAccount },
) {
  async function handle<S>(
    route: string,
    service: S | undefined,
    req: FastifyRequest,
    reply: FastifyReply,
    run: (data: S, user: string, diag: Record<string, unknown>) => Promise<unknown>,
    unavailable = "data_unavailable",
  ) {
    // Counts only: no user ids, measurements, events or profile contents.
    const diag: Record<string, unknown> = { route };
    try {
      if (!service) throw new HttpError(unavailable, 503);
      const result = await run(service, req.userId!, diag);
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
    handle("get", userData, req, reply, async (data, user, diag) => {
      const me = await data.get(user);
      diag.measurements = me.measurements.length;
      return me;
    }),
  );

  app.delete("/me", (req, reply) =>
    handle("delete", deleteAccount, req, reply, (del, user) => del(user), "account_delete_unavailable"),
  );

  app.put("/me/profile", (req, reply) =>
    handle("profile", userData, req, reply, async (data, user) => {
      await data.putProfile(user, snapshot(req.body, PROFILE_LIMIT));
    }),
  );

  app.put("/me/saved", (req, reply) =>
    handle("saved", userData, req, reply, async (data, user) => {
      await data.putSaved(user, snapshot(req.body, SAVED_LIMIT));
    }),
  );

  app.post("/events", (req, reply) =>
    handle("events", trends, req, reply, async (t, user, diag) => {
      const parsed = Events.safeParse(req.body);
      if (!parsed.success) throw new HttpError("invalid_request", 400);
      const events = parsed.data.events.map(({ color, ...e }) => {
        const family = color ? familyOfHex(color) : null;
        return family ? { ...e, family } : e;
      });
      await t.record(user, events);
      diag.recorded = events.length;
    }),
  );

  app.post("/me/measurements", (req, reply) =>
    handle("measurements", userData, req, reply, async (data, user, diag) => {
      const parsed = Measurements.safeParse(req.body);
      if (!parsed.success) throw new HttpError("invalid_request", 400);
      const added = await data.addMeasurements(user, parsed.data.entries);
      diag.added = added;
      return { added };
    }),
  );
}
