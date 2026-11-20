import { apiFetch, setAccessToken, setTokenRefresher } from "../config";

const ok = { status: 200 } as Response;
const refused = { status: 401 } as Response;

it("a token refused after the app slept is refreshed and the request sent once more", async () => {
  const sent: string[] = [];
  global.fetch = jest.fn(async (_url, init) => {
    const auth = (init?.headers as Record<string, string>).authorization;
    sent.push(auth);
    return auth === "Bearer fresh" ? ok : refused;
  }) as never;
  setAccessToken("stale");
  setTokenRefresher(async () => setAccessToken("fresh"));
  expect((await apiFetch("https://api.test/me")).status).toBe(200);
  expect(sent).toEqual(["Bearer stale", "Bearer fresh"]);
});

it("logged out, a 401 is passed on without a retry", async () => {
  global.fetch = jest.fn(async () => refused) as never;
  setAccessToken(null);
  expect((await apiFetch("https://api.test/color-analysis")).status).toBe(401);
  expect(global.fetch).toHaveBeenCalledTimes(1);
});
