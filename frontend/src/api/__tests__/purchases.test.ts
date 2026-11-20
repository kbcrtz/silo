import Purchases from "react-native-purchases";

jest.mock("react-native-purchases", () => ({
  __esModule: true,
  default: {
    configure: jest.fn(),
    addCustomerInfoUpdateListener: jest.fn(),
    getCustomerInfo: jest.fn(),
    logIn: jest.fn(),
    purchasePackage: jest.fn(),
  },
  PACKAGE_TYPE: { ANNUAL: "ANNUAL", MONTHLY: "MONTHLY", WEEKLY: "WEEKLY" },
}));
jest.mock("../config", () => ({ USE_MOCKS: false, sleep: jest.fn() }));

const member = { entitlements: { active: { member: {} } } };
const nobody = { entitlements: { active: {} } };
const sdk = jest.mocked(Purchases) as unknown as Record<
  "configure" | "getCustomerInfo" | "logIn" | "purchasePackage",
  jest.Mock
>;

/** A fresh copy of the module (it remembers the user) with the store switched on, and the membership store it writes to. */
function load() {
  process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY = "appl_test";
  let api!: typeof import("../purchases") & typeof import("@/store/membership");
  jest.isolateModules(() => {
    /* eslint-disable @typescript-eslint/no-require-imports */
    api = { ...require("../purchases"), ...require("@/store/membership") };
  });
  return api;
}

beforeEach(() => {
  jest.clearAllMocks();
  sdk.getCustomerInfo.mockResolvedValue(nobody);
});

it("tries again when switching RevenueCat to the new user failed", async () => {
  const { identify, useMembership } = load();
  await identify("user-a");
  sdk.logIn.mockRejectedValueOnce(new Error("offline"));
  await expect(identify("user-b")).rejects.toThrow("offline");
  sdk.logIn.mockResolvedValue({ customerInfo: member });
  await identify("user-b");
  expect(sdk.logIn).toHaveBeenCalledTimes(2);
  expect(useMembership.getState().active).toBe(true);
});

it("never sells a plan while RevenueCat is still on the previous user", async () => {
  const { identify, buy } = load();
  await identify("user-a");
  sdk.logIn.mockRejectedValue(new Error("offline"));
  await identify("user-b").catch(() => {});
  await expect(
    buy({
      id: "annual",
      price: "",
      perMonth: "",
      perYear: 0,
      pkg: {} as never,
    }),
  ).rejects.toThrow("offline");
  expect(sdk.purchasePackage).not.toHaveBeenCalled();
});

it("looks the membership up again after signing out and back in to the same account", async () => {
  const { identify, forget, useMembership } = load();
  sdk.getCustomerInfo.mockResolvedValue(member);
  await identify("user-a");
  forget();
  useMembership.setState({ active: null }); // sign-out clears it
  sdk.logIn.mockResolvedValue({ customerInfo: member });
  await identify("user-a");
  expect(useMembership.getState().active).toBe(true);
});
