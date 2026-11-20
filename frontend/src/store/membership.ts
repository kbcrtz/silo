import { create } from "zustand";

/**
 * Whether the account has an active membership: from RevenueCat on the phone
 * (src/api/purchases.ts), or false when the server answers 402. Null until
 * known, and always without a store.
 */
export const useMembership = create<{ active: boolean | null }>(() => ({
  active: null,
}));
