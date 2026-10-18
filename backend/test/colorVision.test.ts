import assert from "node:assert/strict";
import { HttpError } from "../src/errors.ts";
import { test } from "node:test";
import { locateRegions, type CreateInteraction } from "../src/services/colorVision.ts";

const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
const observation = {
  face: [100, 200, 900, 800],
  skin: [450, 250, 600, 400],
  lips: [700, 400, 800, 600],
  hair: null,
  iris: [350, 300, 400, 380],
  warnings: {
    lipMakeup: false,
    colorCast: true,
    beautyFilter: false,
    occlusion: false,
    unevenLighting: false,
    overexposed: false,
    underexposed: false,
    blur: false,
    unreliableRegions: false,
  },
};
const opts = (create: CreateInteraction) => ({ create, model: "gemini-test", timeoutMs: 1234 });
const replying = (text: string | undefined): CreateInteraction => async () => ({ output_text: text });

async function failsWith(create: CreateInteraction, code: string, status: number) {
  await assert.rejects(locateRegions(jpeg, opts(create)), (e: unknown) => {
    assert.ok(e instanceof HttpError, String(e));
    assert.equal(e.code, code);
    assert.equal(e.status, status);
    return true;
  });
}

test("parses Gemini's structured observation into regions and warnings", async () => {
  const out = await locateRegions(jpeg, opts(replying(JSON.stringify(observation))));
  assert.deepEqual(out.regions, { face: observation.face, skin: observation.skin, lips: observation.lips, hair: null, iris: observation.iris });
  assert.equal(out.warnings.colorCast, true);
});

test("sends the image with store disabled, a JSON schema, a timeout and no retries", async () => {
  let params: any;
  let options: any;
  const create: CreateInteraction = async (p, o) => {
    params = p;
    options = o;
    return { output_text: JSON.stringify(observation) };
  };
  await locateRegions(jpeg, opts(create));
  assert.equal(params.store, false);
  assert.equal(params.model, "gemini-test");
  const image = params.input.find((part: any) => part.type === "image");
  assert.equal(image.mime_type, "image/jpeg");
  assert.equal(image.data, jpeg.toString("base64"));
  assert.equal(params.response_format.mime_type, "application/json");
  assert.equal(params.response_format.schema.$schema, undefined);
  assert.deepEqual([...params.response_format.schema.required].sort(), ["face", "hair", "iris", "lips", "skin", "warnings"]);
  assert.deepEqual(options, { timeout_ms: 1234, retries: { strategy: "none" } });
});

test("rejects output that is not JSON", async () => {
  await failsWith(replying("Sure! Here are the boxes: ..."), "gemini_invalid_output", 502);
});

test("rejects JSON that does not match the schema", async () => {
  await failsWith(replying(JSON.stringify({ ...observation, lips: [700, 400, 800] })), "gemini_invalid_output", 502);
  const { warnings, ...noWarnings } = observation;
  await failsWith(replying(JSON.stringify(noWarnings)), "gemini_invalid_output", 502);
  await failsWith(replying(JSON.stringify({ ...observation, skin: [450, 250, 600, 4000] })), "gemini_invalid_output", 502);
});

test("rejects an empty response", async () => {
  await failsWith(replying(undefined), "gemini_invalid_output", 502);
});

test("maps an SDK timeout to gemini_timeout", async () => {
  await failsWith(async () => {
    throw Object.assign(new Error("Request timed out"), { name: "RequestTimeoutError" });
  }, "gemini_timeout", 504);
  // What client.interactions.create actually throws when timeout_ms passes.
  await failsWith(async () => {
    throw Object.assign(new Error("Request timed out"), { name: "APIConnectionTimeoutError" });
  }, "gemini_timeout", 504);
});

test("maps any other provider error to gemini_failed", async () => {
  await failsWith(async () => {
    throw new Error("503 overloaded");
  }, "gemini_failed", 502);
});

test("keeps the provider's HTTP status so logs can tell quota, billing and overload apart", async () => {
  await assert.rejects(
    locateRegions(jpeg, opts(async () => {
      throw Object.assign(new Error("Rate limit exceeded"), { status: 429 });
    })),
    (e: unknown) => e instanceof HttpError && e.code === "gemini_failed" && e.providerStatus === 429,
  );
});
