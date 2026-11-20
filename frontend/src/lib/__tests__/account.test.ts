import { accountFrom, afterSignIn } from "../account";

describe("accountFrom", () => {
  it("is none without a session", () => {
    expect(accountFrom(null)).toEqual({ kind: "none" });
  });

  it("keeps an anonymous user anonymous", () => {
    expect(
      accountFrom({ user: { id: "u1", is_anonymous: true, app_metadata: {} } }),
    ).toEqual({ kind: "anonymous", userId: "u1" });
  });

  it("reads the linked provider of a former anonymous user", () => {
    expect(
      accountFrom({
        user: {
          id: "u1",
          is_anonymous: false,
          email: "a@b.co",
          app_metadata: {
            provider: "anonymous",
            providers: ["anonymous", "apple"],
          },
        },
      }),
    ).toEqual({
      kind: "member",
      userId: "u1",
      email: "a@b.co",
      provider: "apple",
    });
  });

  it("falls back to the primary provider", () => {
    expect(
      accountFrom({ user: { id: "u2", app_metadata: { provider: "google" } } }),
    ).toEqual({ kind: "member", userId: "u2", provider: "google" });
  });
});

describe("afterSignIn", () => {
  const at = (onboarded: boolean, active: boolean | null, returning = false) =>
    afterSignIn({ onboarded, active, returning });

  it("sends a restored account without a membership to the plans, not nowhere", () => {
    expect(at(true, false, true)).toBe("paywall");
    expect(at(true, false)).toBe("paywall");
  });

  it("leaves an onboarded member to the root stack, which moves home", () => {
    expect(at(true, true)).toBe("home");
    expect(at(true, null)).toBe("home"); // membership unknown: the server decides
  });

  it("finishes onboarding for a paying shopper, else the plans, or back for a returning one", () => {
    expect(at(false, true)).toBe("finish");
    expect(at(false, false)).toBe("paywall");
    expect(at(false, null, true)).toBe("back");
  });
});
