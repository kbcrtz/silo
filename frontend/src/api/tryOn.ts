import type { CatalogItem } from "@/data/catalog";
import type { Measurements } from "@/lib/measurements";
import { API_URL, USE_MOCKS, expectOk, fileField, sleep } from "./config";

export type TryOnStatus = "queued" | "running" | "succeeded" | "failed";

export type TryOnState = {
  status: TryOnStatus;
  resultUrl?: string;
  error?: string;
};

/**
 * Generation is a job, not a request: it takes seconds to minutes, so the app
 * starts it, then polls.
 *
 * Backend contract:
 * - POST {API_URL}/try-on, multipart: "bodyPhoto" (file), "itemId",
 *   "itemImageUrl" (optional), "measurements" (JSON, cm/kg) -> { jobId }
 * - GET {API_URL}/try-on/{jobId} -> { status, resultUrl?, error? }
 */
export async function startTryOn(
  bodyPhotoUri: string,
  item: CatalogItem,
  measurements: Measurements,
): Promise<string> {
  if (USE_MOCKS) {
    await sleep(400);
    const jobId = `mock-${Date.now()}`;
    mockJobs.set(jobId, { startedAt: Date.now() });
    return jobId;
  }
  const body = new FormData();
  body.append("bodyPhoto", fileField(bodyPhotoUri, "body.jpg"));
  body.append("itemId", item.id);
  if (item.imageUrl) body.append("itemImageUrl", item.imageUrl);
  body.append("measurements", JSON.stringify(measurements));
  const res = await fetch(`${API_URL}/try-on`, { method: "POST", body }).then(
    expectOk,
  );
  const { jobId } = await res.json();
  return jobId;
}

export async function getTryOn(jobId: string): Promise<TryOnState> {
  if (USE_MOCKS) return mockState(jobId);
  const res = await fetch(`${API_URL}/try-on/${jobId}`).then(expectOk);
  return res.json();
}

// Mock: queued for 2s, running until 7s, then succeeds with no resultUrl; the
// result screen shows the body photo in its place. Jobs live in memory, so one
// interrupted by an app restart reports failed.
const mockJobs = new Map<string, { startedAt: number }>();

function mockState(jobId: string): TryOnState {
  const job = mockJobs.get(jobId);
  if (!job) return { status: "failed", error: "Generation was interrupted." };
  const elapsed = Date.now() - job.startedAt;
  if (elapsed < 2000) return { status: "queued" };
  if (elapsed < 7000) return { status: "running" };
  return { status: "succeeded" };
}
