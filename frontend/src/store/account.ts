import { create } from "zustand";
import type { Account } from "@/lib/account";

type AccountState = {
  /** Follows the Supabase session (src/api/supabase.ts); not persisted. */
  account: Account;
  /**
   * Set while signing in, out or deleting: the backups stop so the phone's
   * old state isn't uploaded to an account it no longer matches.
   */
  syncPaused: boolean;
};

export const useAccount = create<AccountState>()(() => ({
  account: { kind: "none" },
  syncPaused: false,
}));
