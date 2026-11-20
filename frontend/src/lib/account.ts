export type Provider = "apple" | "google";

/**
 * Who the app is signed in as: nobody until Apple/Google sign-in, then a
 * "member", whose data comes back on a new phone. "anonymous" is the silent
 * sign-in older builds started with, still on some phones until they sign up.
 */
export type Account =
  | { kind: "none" }
  | { kind: "anonymous"; userId: string }
  | { kind: "member"; userId: string; email?: string; provider?: Provider };

/** The parts of a Supabase session this reads. */
type SessionLike = {
  user: {
    id: string;
    is_anonymous?: boolean;
    email?: string;
    app_metadata?: { provider?: string; providers?: string[] };
  };
} | null;

const PROVIDERS: Provider[] = ["apple", "google"];
const isProvider = (p: unknown): p is Provider =>
  PROVIDERS.includes(p as Provider);

export function accountFrom(session: SessionLike): Account {
  if (!session) return { kind: "none" };
  const { user } = session;
  if (user.is_anonymous) return { kind: "anonymous", userId: user.id };
  // A linked anonymous user keeps "anonymous" as its first provider.
  const meta = user.app_metadata ?? {};
  const provider =
    meta.providers?.find(isProvider) ??
    (isProvider(meta.provider) ? meta.provider : undefined);
  return {
    kind: "member",
    userId: user.id,
    ...(user.email && { email: user.email }),
    ...(provider && { provider }),
  };
}
