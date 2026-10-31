import Purchases, {
  PACKAGE_TYPE,
  type CustomerInfo,
  type PurchasesPackage,
} from "react-native-purchases";
import {
  formatPrice,
  perMonth,
  PLANS,
  yearCost,
  type PlanId,
} from "@/lib/paywall";
import { useMembership } from "@/store/membership";
import { sleep, USE_MOCKS } from "./config";

const API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY;
/** The RevenueCat entitlement every plan unlocks. */
export const ENTITLEMENT = "member";
/** Off in mock mode and in builds without the key; the paywall then fakes the purchase. */
export const STORE_ON = !USE_MOCKS && !!API_KEY;

/** A plan as the App Store sells it, in the shopper's own currency. */
export type Offer = {
  id: PlanId;
  price: string;
  perMonth: string;
  /** What a year costs, only to compare plans (cents in mock mode). */
  perYear: number;
  pkg?: PurchasesPackage;
};

const isActive = (info: CustomerInfo) =>
  info.entitlements.active[ENTITLEMENT] !== undefined;
const track = (info: CustomerInfo) =>
  useMembership.setState({ active: isActive(info) });

let current: string | null = null;
/** The current user's membership lookup, so a second caller waits for the same answer. */
let known: Promise<void> = Promise.resolve();

/**
 * Ties purchases to the Supabase user, so a membership follows the account to
 * any phone. Called on every session change; linking Apple/Google keeps the id.
 * Resolves once the user's membership is known.
 */
export async function identify(userId: string): Promise<void> {
  if (STORE_ON && userId !== current) {
    if (current === null) {
      Purchases.configure({ apiKey: API_KEY!, appUserID: userId });
      Purchases.addCustomerInfoUpdateListener(track);
      current = userId;
      known = Purchases.getCustomerInfo().then(track);
    } else {
      current = userId;
      known = Purchases.logIn(userId).then((r) => track(r.customerInfo));
    }
  }
  return known;
}

const TYPES: Record<PlanId, PACKAGE_TYPE> = {
  annual: PACKAGE_TYPE.ANNUAL,
  monthly: PACKAGE_TYPE.MONTHLY,
  weekly: PACKAGE_TYPE.WEEKLY,
};

/** The plans on sale: the current RevenueCat offering's yearly, monthly and weekly packages. */
export async function loadOffers(): Promise<Offer[]> {
  if (!STORE_ON)
    return (Object.keys(TYPES) as PlanId[]).map((id) => ({
      id,
      price: formatPrice(PLANS[id].cents),
      perMonth: formatPrice(perMonth(PLANS[id])),
      perYear: yearCost(PLANS[id]),
    }));
  const offering = (await Purchases.getOfferings()).current;
  return (Object.keys(TYPES) as PlanId[]).flatMap((id) => {
    const pkg = offering?.availablePackages.find(
      (p) => p.packageType === TYPES[id],
    );
    if (!pkg) return [];
    const p = pkg.product;
    return [
      {
        id,
        price: p.priceString,
        perMonth: p.pricePerMonthString ?? p.priceString,
        perYear: p.pricePerYear ?? 0,
        pkg,
      },
    ];
  });
}

/** Opens Apple's purchase sheet; false when the shopper cancels. */
export async function buy(offer: Offer): Promise<boolean> {
  if (!STORE_ON) {
    await sleep(700);
    return true;
  }
  if (!offer.pkg) throw new Error("That plan isn't on sale right now.");
  try {
    const { customerInfo } = await Purchases.purchasePackage(offer.pkg);
    track(customerInfo);
    // Charged but not unlocked (entitlement misconfigured or slow): say so rather than doing nothing.
    if (!isActive(customerInfo))
      throw new Error(
        "Your purchase went through, but the membership isn't active yet. Try Restore purchases in a moment.",
      );
    return true;
  } catch (e) {
    if ((e as { userCancelled?: boolean | null }).userCancelled) return false;
    throw e;
  }
}

/** Finds a membership bought with this Apple ID before; true when one is active. */
export async function restore(): Promise<boolean> {
  if (!STORE_ON) return false;
  const info = await Purchases.restorePurchases();
  track(info);
  return isActive(info);
}
