import { analysisErrorMessage } from "../analysisError";

const http = (status: number, code: string) =>
  new Error(`${status} ${JSON.stringify({ error: code })}`);

describe("analysisErrorMessage", () => {
  it("says no face was found instead of blaming the connection", () => {
    const m = analysisErrorMessage(http(422, "no_usable_face"));
    expect(m.title).toBe("No clear face found");
    expect(m.body).not.toMatch(/connection/i);
  });

  it("explains photos the server can't use", () => {
    for (const [status, code] of [
      [415, "unsupported_image_type"],
      [400, "invalid_image"],
      [422, "image_dimensions"],
      [413, "file_too_large"],
    ] as const)
      expect(analysisErrorMessage(http(status, code)).title).toBe(
        "This photo can't be used",
      );
  });

  it("asks to wait when rate limited or busy", () => {
    expect(analysisErrorMessage(http(429, "rate_limited")).title).toBe(
      "Too many tries",
    );
    expect(analysisErrorMessage(http(503, "busy")).title).toBe(
      "Too many tries",
    );
  });

  it("blames the analysis service, not the user, for server failures", () => {
    expect(analysisErrorMessage(http(504, "gemini_timeout")).title).toBe(
      "Analysis is busy",
    );
    expect(analysisErrorMessage(http(502, "gemini_failed")).title).toBe(
      "Analysis is busy",
    );
  });

  it("only blames the connection when the request never got an answer", () => {
    expect(
      analysisErrorMessage(new TypeError("Network request failed")).body,
    ).toMatch(/connection/i);
    expect(analysisErrorMessage(http(401, "unauthorized")).title).toBe(
      "Can't reach Silo's server",
    );
  });
});
