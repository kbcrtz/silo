# Silo backend

Server for the Silo app. Phase 1 implements color analysis only; try-on (FASHN), TigerData persistence and Supabase auth come later (see the team's MVP design doc).

Stack: Node 24+ running TypeScript directly (type stripping, no build step), Fastify, sharp, zod, `@google/genai`.

## Run it

```sh
npm install
cp .env.template .env   # set GEMINI_API_KEY
npm start               # http://0.0.0.0:8080
```

In Google AI Studio, turn off project-level logging for the key used here, so selfies are not kept as logs.

The endpoint has no auth yet and every request is a billed Gemini call. Keep it on your local network; add auth or a shared secret before exposing it publicly. A 502 log line carries `providerStatus` (429 quota or spend cap, 402 billing, 503 overload).

Point the app at it with `EXPO_PUBLIC_API_URL` and `EXPO_PUBLIC_USE_MOCKS=false` in `frontend/.env`. A phone needs your machine's LAN IP or a deployed HTTPS URL, not `localhost`.

## Checks

```sh
npm test            # node --test, no network: Gemini is faked
npm run typecheck
```

## API contract

The app already calls these, behind mocks, in `frontend/src/api/`. Match these shapes; when they change, update `frontend/src/api/` and `frontend/README.md` in the same change.

- `POST /color-analysis`, multipart `selfie` → `{ warmth, depth, clarity, confidence }`. Axes are -1..1, confidence 0..1; the axes are defined in `frontend/src/data/seasons.ts`. **Implemented.**
- `POST /try-on`, multipart `bodyPhoto` (file), `itemId`, `itemImageUrl?`, `measurements` (JSON, cm/kg) → `{ jobId }`. Not implemented yet.
- `GET /try-on/:jobId` → `{ status: "queued" | "running" | "succeeded" | "failed", resultUrl?, error? }`. Not implemented yet.

Errors are `{ "error": "<code>" }` with a non-2xx status. The app treats any non-2xx as "couldn't analyze", offering retake or quiz-only.

| Status | Code | When |
| --- | --- | --- |
| 400 | `missing_selfie` | No multipart `selfie` file |
| 400 | `empty_file`, `invalid_image` | Empty or corrupt image |
| 413 | `file_too_large` | Over 8 MB |
| 415 | `unsupported_image_type` | Not JPEG, PNG or WebP by its bytes (HEIC included) |
| 422 | `image_dimensions` | Shorter side under 256 px, longer side over 8000 px, or over 25 MP |
| 422 | `no_usable_face` | No single face, or no usable skin sample |
| 502 | `gemini_failed`, `gemini_invalid_output` | Gemini errored or returned output that fails the schema |
| 504 | `gemini_timeout` | Gemini took longer than `GEMINI_TIMEOUT_MS` |

## How color analysis works

1. **Validate the selfie** (`src/services/image.ts`): the type is detected from the file bytes, not the MIME label or filename. Size and dimensions are checked, EXIF orientation is applied, and metadata is stripped. Nothing is written to disk or a database.
2. **Localize regions with Gemini** (`src/services/colorVision.ts`): a downscaled copy goes to Gemini through the Interactions API with `store: false` and a JSON schema. Gemini returns boxes (`[ymin, xmin, ymax, xmax]`, 0–1000) for face, a skin patch, lips, hair and one iris, plus image-quality warnings such as lip makeup, color cast, filters, lighting and blur. The output is validated with zod.
3. **Check the boxes** (`src/analysis/regions.ts`): ordering, bounds, regions inside the face, iris above lips, and no heavy overlap. A rejected box counts as questionable localization.
4. **Sample real pixels** (`src/analysis/regions.ts`): from the same downscaled copy Gemini saw (long side 1536 px), each box is shrunk, DSCAS's too-dark and too-bright pixels are dropped, shadows and highlights are trimmed, and the per-channel median is the region color. Gemini never supplies colors.
5. **Apply the rules** (`src/analysis/evaluate.ts` + `rules/color-analysis.v1.json`): DSCAS's subtone, intensity, value and contrast metrics are mapped to continuous warmth, depth and clarity. Confidence comes from documented penalties and caps.
6. **Respond** with exactly the four numbers, validated against the contract. The app blends them with the quiz and picks the season; this server never picks one.

Every number the rules use (cutoffs, spreads, weights, penalties, caps, sampling) lives in the versioned rule document, not in code.

### Logs

One `color_analysis` line per request: request id, model, rule version, which boxes Gemini returned, which were rejected, which regions were sampled, which metrics were available, warnings, penalties and caps applied, whether the output passed validation, duration, and an error code. No images, colors, metric values or traits are logged.

## Attribution and limits

The metrics and cutoffs are adapted from the [Deep Seasonal Color Analysis System (DSCAS)](https://github.com/mrcmich/deep-seasonal-color-analysis-system) by Francesco Baraldi, Matteo Pagliani and GitHub user mrcmich. The upstream repository declares no license, so no DSCAS code or model weights are copied: only the published method is reimplemented.

- DSCAS's cutoffs come from its own segmentation network and color extraction on its own dataset. They are uncalibrated for Gemini-localized, box-sampled inputs.
- The spreads, weights, penalties, caps and sampling values are provisional team choices that need tuning on real photos.
- Results are not clinically or scientifically validated. Confidence is a heuristic, not a probability.
- Test across a range of skin tones and lighting before presenting recommendations with confidence. Boxes are not segmentation masks.
