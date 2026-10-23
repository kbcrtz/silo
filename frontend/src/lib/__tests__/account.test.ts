import { accountFrom } from "../account";

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
