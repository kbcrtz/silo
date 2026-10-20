import type { Verify } from "../../src/auth.ts";

/** A login token the fake verifier accepts as USER; route tests don't need real JWTs. */
export const TOKEN = "good-token";
export const USER = "6f1d2c3b-4a5e-4f60-8a7b-9c0d1e2f3a4b";
export const verify: Verify = async (token) => (token === TOKEN ? USER : null);
