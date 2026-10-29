import { Paywall } from "@/components/Paywall";
import { useProfile } from "@/store/profile";

/**
 * Onboarding's last step. Silo is paid only, so choosing a plan is what
 * finishes onboarding; setting onboarded swaps the root stack's protected
 * groups and the router moves home on its own.
 */
export default function PaywallStep() {
  const set = useProfile((s) => s.set);
  return <Paywall onSubscribed={() => set({ onboarded: true })} />;
}
