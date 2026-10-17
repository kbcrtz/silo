import type { PhotoTraits } from "@/lib/colorAnalysis";
import { API_URL, USE_MOCKS, expectOk, fileField, sleep } from "./config";

/**
 * Estimates color traits from a selfie.
 *
 * Backend contract: POST {API_URL}/color-analysis, multipart field "selfie",
 * responds { warmth, depth, clarity, confidence } with axes in -1..1 and
 * confidence in 0..1 (see data/seasons.ts for what the axes mean).
 */
export async function analyzeSelfie(selfieUri: string): Promise<PhotoTraits> {
  if (USE_MOCKS) {
    await sleep(1800);
    return { warmth: 0.4, depth: 0.1, clarity: -0.5, confidence: 0.6 };
  }
  const body = new FormData();
  body.append("selfie", fileField(selfieUri, "selfie.jpg"));
  const res = await fetch(`${API_URL}/color-analysis`, {
    method: "POST",
    body,
  }).then(expectOk);
  return res.json();
}
