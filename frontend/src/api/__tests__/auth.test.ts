import { signIn } from "../auth";
import { supabase } from "../supabase";
import { useProfile } from "@/store/profile";

jest.mock("expo-apple-authentication", () => ({
  signInAsync: jest.fn(async () => ({ identityToken: "apple-token" })),
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
}));
jest.mock("@react-native-google-signin/google-signin", () => ({
  GoogleSignin: { signOut: jest.fn() },
}));
jest.mock("../config", () => ({ USE_MOCKS: false, sleep: jest.fn() }));
jest.mock("../purchases", () => ({
  identify: jest.fn(async () => {}),
  forget: jest.fn(),
}));
jest.mock("../userData", () => ({
  fetchBackup: jest.fn(async () => {
    throw new Error("502");
  }),
  mergeAnonymous: jest.fn(),
  downloadPhoto: jest.fn(async () => null),
}));
jest.mock("../supabase", () => ({
  supabase: {
    auth: {
      getSession: jest.fn(async () => ({ data: { session: null } })),
      signInWithIdToken: jest.fn(async () => ({ error: null })),
      signOut: jest.fn(async () => ({})),
    },
  },
}));

it("signs back out when the account's data can't be fetched, so the phone can't back up over it", async () => {
  // A phone that redid onboarding before signing in to an existing account.
  useProfile.setState({ colorProfile: { seasonId: "soft-autumn" } as never });
  await expect(signIn("apple")).rejects.toThrow("502");
  expect(supabase!.auth.signOut).toHaveBeenCalled();
});
