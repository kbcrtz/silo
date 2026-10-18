# Silo backend

Server for the Silo app: color analysis and a live product feed from Shopify's Global Catalog. Try-on (FASHN), TigerData persistence and Supabase auth come later (see the team's MVP design doc).

Stack: Node 24+ running TypeScript directly (type stripping, no build step), Fastify, sharp, zod, `@google/genai`. The catalog uses plain `fetch`.

## Run it

```sh
npm install
cp .env.template .env   # set GEMINI_API_KEY and API_SECRET
npm start               # http://0.0.0.0:8080
```

In Google AI Studio, turn off project-level logging for the key used here, so selfies are not kept as logs.

Every route requires `Authorization: Bearer <API_SECRET>`. The server listens on all interfaces so a phone on the LAN can reach it; the secret is what stops everyone else. Set the same value as `EXPO_PUBLIC_API_SECRET` in the app. That value is compiled into the app, so it only keeps other devices on the network out. Use HTTPS before putting this anywhere public: the secret and the selfie both travel with the request.

Color analysis allows 8 calls per 10 minutes from one client, and at most 2 Gemini calls run at once. A 502 log line carries `providerStatus` (429 quota or spend cap, 402 billing, 503 overload). Catalog cursors are HMAC-signed with `API_SECRET`; a cursor this process did not sign is `invalid_cursor`.

Point the app at it with `EXPO_PUBLIC_API_URL` and `EXPO_PUBLIC_USE_MOCKS=false` in `frontend/.env`. A phone needs your machine's LAN IP or a deployed HTTPS URL, not `localhost`.

## Checks

```sh
npm test            # node --test, no network: Gemini and Shopify are faked
npm run typecheck
```

## API contract

The app already calls these, behind mocks, in `frontend/src/api/`. Match these shapes; when they change, update `frontend/src/api/` and `frontend/README.md` in the same change.

- `POST /color-analysis`, multipart `selfie` → `{ warmth, depth, clarity, confidence }`. Axes are -1..1, confidence 0..1; the axes are defined in `frontend/src/data/seasons.ts`. **Implemented.**
- `POST /try-on`, multipart `bodyPhoto` (file), `itemId`, `itemImageUrl?`, `measurements` (JSON, cm/kg) → `{ jobId }`. Not implemented yet.
- `GET /try-on/:jobId` → `{ status: "queued" | "running" | "succeeded" | "failed", resultUrl?, error? }`. Not implemented yet.
- `GET /catalog/discover` → `{ products: CatalogProduct[], cursor: string | null, source: "shopify" }`. **Implemented**; see [Catalog](#catalog).
- `GET /catalog/product?id=<gid>&selected=<JSON>` → `{ product: CatalogProduct }` with images, description and variants. **Implemented.**

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
| 401 | `unauthorized` | Missing or wrong bearer token |
| 429 | `rate_limited` | More than 8 color analyses from this client in 10 minutes |
| 503 | `busy` | Two color analyses are already running |
| 400 | `invalid_request`, `invalid_cursor` | Catalog query parameters fail validation, or a cursor this process did not sign |
| 404 | `product_not_found` | The id doesn't resolve, or the listing has no merchant link |
| 502 | `catalog_unavailable`, `catalog_invalid_response` | Shopify errored, or answered in a shape we can't read |
| 503 | `catalog_rate_limited` | Shopify's shared anonymous rate limit, after one retry |
| 504 | `catalog_timeout` | Shopify took longer than `CATALOG_TIMEOUT_MS` (default 8 s) |

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

## Catalog

Live listings from [Shopify Global Catalog](https://shopify.dev/docs/agents/catalog/global-catalog) (`https://catalog.shopify.com/api/ucp/mcp`, JSON-RPC `search_catalog` and `get_product`). Access is anonymous: no Shopify account or key, only a UCP agent profile URL. The default is Shopify's documented example profile, which is fine for testing; host our own profile and set `SHOPIFY_AGENT_PROFILE` before relying on it.

### `GET /catalog/discover`

| Param | Values |
| --- | --- |
| `category` | `for-you` (default), `all`, `tops`, `bottoms`, `jeans`, `shorts`, `sweats`, `dresses`, `outerwear` |
| `q` | Search text, up to 100 characters |
| `shopFor` | `womens`, `mens`, `both` (default) |
| `style` | `minimal`, `colorful`, `dark`, `none` (default) |
| `palette`, `neutrals` | The season's best and neutral colors, comma-separated `#RRGGBB`, up to 16 each |
| `priceMin`, `priceMax` | Whole dollars |
| `cursor` | The previous page's `cursor`; null means no more pages |

- **A category** (`src/catalog/query.ts`) is one 20-item search such as "men's jeans". Search text narrows it ("women's wool jackets and coats"). Every search has Shopify's clothing taxonomy filter (`aa-1`), ships to `CATALOG_COUNTRY` and asks for available items.
- **For You** with no search text is a fixed plan of up to 8 searches pairing palette color words with garments, e.g. "women's sage knit sweater". Each also filters on Shopify's Color attribute with that word's color family (sage → Green, camel → Brown; `src/catalog/colors.ts`), so results come back on a variant in that color. Shopify maps merchant names into families itself ("Espresso" → Brown); the 13 families were checked live, and a few are noisy (Yellow returns some white items). The style picks which colors lead: neutrals for `minimal` (which also adds "minimalist"), the most saturated for `colorful`, the darkest for `dark`. Palette hexes become search words through the nearest entry in `src/catalog/colors.ts`. Each page runs two plan searches of 10 and interleaves them. After the first pass through the plan, each search resumes from its own Shopify cursor, all carried in the opaque `cursor`.
- **Each page** is deduplicated by product id and capped at 2 products per merchant, so page sizes vary and can be under 20.
- Changing `category`, `q`, `shopFor`, `style` or the palette starts a new feed: drop the old cursor.

### `CatalogProduct`

`id` (Shopify product GID), `variantId`, `title`, `url`, `merchant { name, url? }`, `image { url, alt } | null`, `price { minor, currency, formatted } | null`, `category?`, `color`, `options`, `sizes`, `selected`, `available`, `rating?`. Detail adds `images`, `description` (plain text) and `variants`.

- **`url`** is the shown variant's merchant page exactly as Shopify gave it. Search results carry no `product.url`, so the variant's is used. Listings without one are dropped, never linked by guesswork.
- **`price`** comes from minor units in the listing's own currency (`JPY` has none). Listings can come back in non-US currencies even with US shipping.
- **`color`** is `{ name, hex, source }`: the merchant's color option for the shown variant (`variant`), or a color word in the title (`title`). Shopify gives names, never hex, so `hex` is an approximate swatch from the name table and is null for names like "Bering Sea". Use it for broad ranking only. Nothing reads product images.
- **`sizes`** are the labels of options named like "size" (S, 32"). They are not garment measurements.
- **`estimate`** (optional) is Gemini's reading of the listing text: `{ hex, confidence, cut: { category, silhouette, length, sleeve? }, evidence, source: "ai" }`. Each page's title, color, fit options, description and Shopify feature notes go to Gemini in parallel batches of 5 (`src/services/listingInsights.ts`): text only, no images and nothing about the shopper. Labeled specs ("Fit: Relaxed", "Length: Mini") are sent too, minus care and sizing lines. It uses `CATALOG_AI_MODEL` (default `gemini-3.5-flash-lite`, about 1.5 s for a 20-item page; Flash took about 4 s). The color is the model's idea of the color name, such as a stock "olive", not the store's actual shade. If Gemini fails or passes `CATALOG_AI_TIMEOUT_MS` (default 3 s), the page returns without estimates. `CATALOG_AI=off` turns it off.
- **`selected`** is the shown variant's options. Pass it to `/catalog/product` so the detail opens on the same variant.
- Shopify returns no image dimensions, so the app learns each image's aspect ratio when it loads.

### Shopify rules and limits

- Nothing is cached or stored, and images are never downloaded: Shopify's catalog terms forbid caching results and allow images only alongside their listing. The app should show them with `cachePolicy="none"`.
- Anonymous access has shared, low rate limits. The server keeps at most 2 Shopify calls open and retries a 429 or 5xx once, after `Retry-After` (up to 3 s) or 500 ms. Timeouts aren't retried. A request the app abandons cancels its Shopify call.
- Only fashion attributes go to Shopify: category, search text, department, style words and palette color words. Never selfies or measurements. Logs carry counts and the category only, plus how many products got an estimate or why none did.

## Attribution and limits

The metrics and cutoffs are adapted from the [Deep Seasonal Color Analysis System (DSCAS)](https://github.com/mrcmich/deep-seasonal-color-analysis-system) by Francesco Baraldi, Matteo Pagliani and GitHub user mrcmich. The upstream repository declares no license, so no DSCAS code or model weights are copied: only the published method is reimplemented.

- DSCAS's cutoffs come from its own segmentation network and color extraction on its own dataset. They are uncalibrated for Gemini-localized, box-sampled inputs.
- The spreads, weights, penalties, caps and sampling values are provisional team choices that need tuning on real photos.
- Results are not clinically or scientifically validated. Confidence is a heuristic, not a probability.
- Test across a range of skin tones and lighting before presenting recommendations with confidence. Boxes are not segmentation masks.
