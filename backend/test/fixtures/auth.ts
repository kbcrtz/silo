import type { Verify } from "../../src/auth.ts";

/** Login tokens the fake verifier accepts; route tests don't need real JWTs. */
export const TOKEN = "good-token";
export const USER = "6f1d2c3b-4a5e-4f60-8a7b-9c0d1e2f3a4b";
/** A silent anonymous sign-in, before Apple/Google. */
export const ANON_TOKEN = "anon-token";
export const ANON_USER = "a0a0a0a0-1b1b-4c2c-8d3d-4e4e4e4e4e4e";
export const verify: Verify = async (token) =>
  token === TOKEN ? { id: USER, anonymous: false } : token === ANON_TOKEN ? { id: ANON_USER, anonymous: true } : null;
