import { tryOnGuide } from "../catalog";

const body = { height: 165, weight: 62, chest: 90, waist: 72, hips: 98 };

test("the guide is the drawn body, small enough for the backend", () => {
  const guide = tryOnGuide(body, "womens");
  expect(guide.body).toHaveLength(2);
  for (const outline of guide.body)
    for (const p of outline) expect(p).toHaveLength(2);
  expect(JSON.stringify(guide).length).toBeLessThan(12_000); // the backend's limit
});

test("measurements a centimeter apart share one guide (one saved image); another body gets its own", () => {
  const same = JSON.stringify(tryOnGuide(body, "womens"));
  expect(
    JSON.stringify(tryOnGuide({ ...body, waist: 72.6, hips: 97.4 }, "womens")),
  ).toBe(same);
  expect(
    JSON.stringify(tryOnGuide({ ...body, waist: 96, hips: 118 }, "womens")),
  ).not.toBe(same);
});
