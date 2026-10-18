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

let pending: { uri: string; result: Promise<PhotoTraits> } | null = null;

/**
 * Starts (or joins) analysis of a selfie. The selfie step calls this as soon
 * as a photo is picked, so it runs while the user answers the photo
 * questions; awaiting it again for the same photo doesn't upload twice.
 */
export function analyzeSelfieOnce(selfieUri: string): Promise<PhotoTraits> {
  if (pending?.uri !== selfieUri) {
    const result = analyzeSelfie(selfieUri);
    pending = { uri: selfieUri, result };
    // A failure is retried by the next call rather than cached.
    result.catch(() => {
      if (pending?.result === result) pending = null;
    });
  }
  return pending.result;
}
