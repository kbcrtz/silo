# Silo backend

Server for the Silo app: color analysis, a live product feed from Shopify's Global Catalog, AI try-on images, and signed-in users' data in Supabase Postgres. Sign-in is Supabase Auth (Apple and Google); the backend checks the login token and is the only thing that reads or writes the tables.

Stack: Node 24+ running TypeScript directly (type stripping, no build step), Fastify, sharp, zod, `@google/genai`, `postgres`, `jose`. The catalog uses plain `fetch`.

## Run it

```sh
npm install
cp .env.template .env   # set GEMINI_API_KEY, CURSOR_SECRET and the Supabase values
npm start               # http://0.0.0.0:8080
```

The database schema lives in `supabase/migrations/` at the repo root. Locally, with Docker running:

```sh
cd .. && supabase start   # local Postgres + Auth; `supabase status` prints the URLs and keys for .env
supabase db reset         # applies the migrations to the local database
```

To use a hosted project instead, `supabase link` it and `supabase db push`, then point `SUPABASE_URL`, `SUPABASE_SECRET_KEY` and `DATABASE_URL` at it (`DATABASE_URL` from the dashboard's Connect panel, with `?sslmode=require`; use the direct or session-pooler string, not the transaction pooler).

In Google AI Studio, turn off project-level logging for the key used here, so selfies are not kept as logs.

Every route except `POST /color-analysis` requires `Authorization: Bearer <Supabase access token>` from a signed-in Supabase user. Older app builds signed in silently as an anonymous Supabase user; current ones don't (onboarding runs logged out and the account is made at Apple/Google sign-in). Anonymous tokens count while `ALLOW_ANONYMOUS` is on (the default in `src/index.ts`; the app factory itself refuses them unless told). Set `ALLOW_ANONYMOUS=false` once testers have a build without them; no code change. Tokens are verified locally against the project's public signing keys (`SUPABASE_URL/auth/v1/.well-known/jwks.json`, issuer `SUPABASE_URL/auth/v1`, audience `authenticated`), so the project must use asymmetric JWT signing keys. Color analysis stays open because onboarding runs before sign-up; it keeps its per-client limits. Use HTTPS before putting this anywhere public: the token and the selfie both travel with the request.

Color analysis allows 30 calls per 10 minutes from one client (a few people retaking selfies on one Wi-Fi), and at most 6 Gemini calls run at once. "Client" is the IP address: behind a proxy, set `TRUST_PROXY` to the proxy's addresses (default `100.64.0.0/10`, Railway's) so the address comes from the last `X-Forwarded-For` entry, which the proxy appends; client-written entries before it are ignored. The first proxied request logs `proxy_check` with `proxyTrusted`; if it is false, set `TRUST_PROXY` to the logged `proxyNetwork`, or every user shares one limit. A 502 log line carries `providerStatus` (429 quota or spend cap, 402 billing, 503 overload). Catalog cursors are HMAC-signed with `CURSOR_SECRET`; a cursor this process did not sign is `invalid_cursor`.

Point the app at it with `EXPO_PUBLIC_API_URL` and `EXPO_PUBLIC_USE_MOCKS=false` in `frontend/.env`. A phone needs your machine's LAN IP or a deployed HTTPS URL, not `localhost`.

## Checks

```sh
npm test            # node --test, no network: Gemini, Shopify and Supabase Auth are faked
npm run typecheck
# Also run the database tests against the local stack (migrations applied):
TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres npm test
```

## API contract

The app already calls these, behind mocks, in `frontend/src/api/`. Match these shapes; when they change, update `frontend/src/api/` and `frontend/README.md` in the same change.

- `POST /color-analysis`, multipart `selfie` → `{ warmth, depth, clarity, confidence }`. Axes are -1..1, confidence 0..1; the axes are defined in `frontend/src/data/seasons.ts`. **Implemented.**
- `POST /try-on`, multipart `bodyPhoto` (file), `itemId`, `itemImageUrl?`, `measurements` (JSON, cm/kg) → `{ jobId }`. Not implemented yet.
- `GET /try-on/:jobId` → `{ status: "queued" | "running" | "succeeded" | "failed", resultUrl?, error? }`. Not implemented yet.
- `GET /catalog/discover` → `{ products: CatalogProduct[], cursor: string | null, source: "shopify" }`. **Implemented**; see [Catalog](#catalog).
- `GET /catalog/product?id=<gid>&selected=<JSON>` → `{ product: CatalogProduct }` with images, description and variants. **Implemented.**
- `GET /catalog/tryon-image?id=<gid>&shopFor=&category=&selected=<JSON>&guide=<JSON>` → `image/jpeg`: a full-body mannequin with the shopper's proportions wearing the product, in the variant's color. With `fit=<JSON>` instead of `id`, one image of a whole fit (2–3 pieces). **Implemented**; see [AI try-on images](#ai-try-on-images).
- `GET /me`, `PUT /me/profile`, `PUT /me/saved`, `POST /me/measurements`, `PUT`/`GET /me/photo`, `POST /events`, `POST /me/merge`, `DELETE /me`: the signed-in user's data, keyed by their Supabase user id. **Implemented**; see [User data](#user-data).

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
| 401 | `unauthorized` | Missing, invalid or expired login token (every route but color analysis) |
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
| `seed` | A random whole number, 0 to 2³¹−1, new on every feed open and refresh. Optional; later pages use the one in the cursor |
| `cursor` | The previous page's `cursor`; null means no more pages |

- **A category** (`src/catalog/query.ts`) is one 20-item search such as "men's jeans". Search text narrows it ("women's wool jackets and coats"). Every search has Shopify's clothing taxonomy filter (`aa-1`), ships to `CATALOG_COUNTRY` and asks for available items.
- **For You** with no search text is a fixed plan of up to 8 searches pairing palette color words with garments, e.g. "women's sage knit sweater". Each also filters on Shopify's Color attribute with that word's color family (sage → Green, camel → Brown; `src/catalog/colors.ts`), so results come back on a variant in that color. Shopify maps merchant names into families itself ("Espresso" → Brown); the 13 families were checked live, and a few are noisy (Yellow returns some white items). The style picks which colors lead: neutrals for `minimal` (which also adds "minimalist"), the most saturated for `colorful`, the darkest for `dark`. Palette hexes become search words through the nearest entry in `src/catalog/colors.ts`. Each page runs two plan searches of 10 and interleaves them. After the first pass through the plan, each search resumes from its own Shopify cursor, all carried in the opaque `cursor`.
- **A seed varies the feed.** Shopify ranks a query the same way every time and has no "newest" sort, so the same searches always returned the same products. With a `seed`, a category becomes up to 4 searches with different style words ("women's ribbed tops", "women's linen tops", plain "women's tops"…), and For You starts at a random palette color, shuffles the garments and adds a style word to each search (`VARIETY` in `src/catalog/query.ts`). The color filter stays. The products on each page are shuffled too. The seed rides in the signed cursor, so later pages follow the same plan. In a live check, three refreshes of a For You first page shared no products and showed 41 stores. Search text is never changed. Without a seed, the old fixed plan is used.
- **Each page** is deduplicated by product id and capped at 2 products per merchant, so page sizes vary and can be under 20.
- Changing `category`, `q`, `shopFor`, `style` or the palette starts a new feed: drop the old cursor.

### `CatalogProduct`

`id` (Shopify product GID), `variantId`, `title`, `url`, `merchant { name, url? }`, `image { url, alt } | null`, `price { minor, currency, formatted } | null`, `category?`, `color`, `options`, `sizes`, `selected`, `available`, `rating?`. Detail adds `images`, `description` (plain text) and `variants`.

- **`url`** is the shown variant's merchant page exactly as Shopify gave it. Search results carry no `product.url`, so the variant's is used. Listings without one are dropped, never linked by guesswork.
- **`price`** comes from minor units in the listing's own currency (`JPY` has none). Listings can come back in non-US currencies even with US shipping.
- **`color`** is `{ name, hex, source }`: the merchant's color option for the shown variant (`variant`), or a color word in the title (`title`). Shopify gives names, never hex, so `hex` is an approximate swatch from the name table and is null for names like "Bering Sea". Use it for broad ranking only. Nothing reads product images.
- **`sizes`** are the labels of options named like "size" (S, 32"). They are not garment measurements.
- **`estimate`** (optional) is Gemini's reading of the listing text: `{ hex, confidence, cut: { category, silhouette, length, sleeve? }, pattern, accent, clothing, department, evidence, source: "ai" }`. `department` (`womens`, `mens` or `unisex`) is who the listing is made for: the department is only a word in the Shopify search, so some of the other one comes back, and a men's or women's feed drops the other department's listings. Without an estimate, a title that names the other department ("Women’s …") is dropped instead. Each page's title, color, fit options, description and Shopify feature notes go to Gemini in parallel batches of 5 (`src/services/listingInsights.ts`): text only, no images and nothing about the shopper. Labeled specs ("Fit: Relaxed", "Length: Mini") are sent too, minus care and sizing lines. It uses `CATALOG_AI_MODEL` (default `gemini-3.5-flash-lite`, about 1.5 s for a 20-item page; Flash took about 4 s). The color is the model's idea of the color name, such as a stock "olive", not the store's actual shade. If Gemini fails or passes `CATALOG_AI_TIMEOUT_MS` (default 3 s), the page returns without estimates. Each user gets 30 AI-read pages per 10 minutes (8 at once); past that, pages load without estimates (`estimateError: "estimate_budget"` in the log). `CATALOG_AI=off` turns it off.
- **`selected`** is the shown variant's options. Pass it to `/catalog/product` so the detail opens on the same variant.
- Shopify returns no image dimensions, so the app learns each image's aspect ratio when it loads.

### Shopify rules and limits

- Nothing is cached or stored, and images are never downloaded: Shopify's catalog terms forbid caching results and allow images only alongside their listing. The app should show them with `cachePolicy="none"`.
- Anonymous access has shared, low rate limits. The server keeps at most 2 Shopify calls open and retries a 429 or 5xx once, after `Retry-After` (up to 3 s) or 500 ms. Timeouts aren't retried. A request the app abandons cancels its Shopify call.
- Only fashion attributes go to Shopify: category, search text, department, style words and palette color words. Never selfies or measurements. Logs carry counts and the category only, plus how many products got an estimate or why none did.

## AI try-on images

`GET /catalog/tryon-image?id=<gid>&shopFor=womens|mens|both&category=top|bottom|dress|outerwear&selected=<JSON>&guide=<JSON>` returns a JPEG (3:4) of a faceless light-gray dress-form mannequin, head to feet, wearing only the product (`src/services/tryOnImage.ts`); everywhere else the mannequin is bare, so a shirt leaves the legs bare and trousers the chest. It is made from the product's store photo with one fixed prompt template, so every product comes out in the same studio style. `category` (what the feed's listing reader already found) says what kind of item it is. Without it (older app builds), the listing reader runs here first, about 1 s, alongside the photo download.

- `guide` is the app's drawn mannequin body: `{ body: [head, silhouette] }`, each an outline of `[x, y]` points in cm (origin at the top of the head), between 1 and 2.5 m tall.
  - It's drawn as a flat pale-blue silhouette (blue, so it can't be copied as the gray mannequin) and sent as the first image, before the store photo. The prompt adds the build in words (slender, average, curvy or plus-size, and petite or tall), worked out from the silhouette's area and height.
  - Gemini copies the shopper's widths and leg length from it. The garment's colors, cut and details come from the photo, which the prompt names by its listing title.
  - In testing on Lite, each change mattered. Outlines alone, or clothes drawn over the body, left plus-size bodies about 25% too slim. Clothes drawn in the diagram also got copied as flat shapes. With the filled body first and the build in words, the error was 2–10%.
  - Without a guide (older app builds), the listing reader's fit, length and sleeves go in the prompt and the body is generic.
- **Full fit:** `fit=<JSON>` replaces `id`, `category` and `selected`: `[{"id":"<gid>","category":"top","selected":[...]}, ...]`, 2–3 pieces, one of each kind; a dress takes the place of the top and bottoms (top + bottom (+ outerwear), or dress + outerwear). `guide` is required. One Gemini call gets the body diagram first, then one store photo per piece, inner layers first; the prompt names each photo by its listing title (in testing, without the titles Lite took a color from the wrong photo) and puts a jacket on open over the top or dress. The image costs about the same as a one-item image, and counts once against the budget. It's saved under the pieces, their colors, the department, the guide and `FIT_VERSION`, so the same pieces in any order share one image.
- If Gemini answers without an image, the request is retried once.
- Gemini sometimes paints a light-gray backdrop; a flood fill from the border turns it pure white before saving.

- Model: `TRYON_IMAGE_MODEL`, default `gemini-3.1-flash-lite-image` (about 6 s for a new image in testing).
- `selected` is the shown variant's options, e.g. `[{"name":"Color","label":"Light Blue"}]`. Only the color option is used: it goes to Shopify's `get_product`, so the photo is that color's, and into the saved image's key. Without it, Shopify answers with the store's default variant, whose photo is often another color.
- Each image is saved in `tryon_images` (Postgres bytea, keyed by product, department, color, a hash of the guide and template version) and served from there next time (about 0.4 s); a daily pg_cron job deletes them after 7 days (`supabase/migrations/20261031120000_daily_cleanup.sql`), since the phone keeps its own copy and the fit, product and body behind it stay on the account, so a later view just makes it again. Two identical requests at once share one generation. Without a database it's kept in memory. Bump `TEMPLATE_VERSION` when the template changes.
- Photos are fetched only from `https://cdn.shopify.com`, at most 8 MB, and never written to disk.
- New images are capped at 20 per user per 10 minutes, 8 at once (429 `rate_limited`, 503 `busy`); saved ones don't count. Anonymous logins also share 60 per IP per 10 minutes, since a new anonymous login is free.
- Errors: 400 `invalid_request` (also a malformed guide), 404 `product_not_found`, 422 `no_photo` or `not_clothing` (shoes, bags), 502/504 for Gemini failures.

## User data

Onboarding (quiz, selfie analysis, passport) runs logged out and keeps everything on the phone. After sign-up the app sends that data here, and keeps it current from then on. Rows are keyed by the Supabase user id from the login token (`src/services/userData.ts`). Without `DATABASE_URL` the routes answer 503 `data_unavailable` and everything else works. The selfie is kept only as the passport photo, compacted here to a ~30 KB JPEG (at most 480 px, no EXIF or GPS).

| Route | Body | Table |
| --- | --- | --- |
| `PUT /me/profile` | `{ data }`, the profile store without the photo file names (≤ 32 KB); replaces | `profiles` (jsonb) |
| `PUT /me/saved` | `{ data }`, saved ids, lists and bookmarks (≤ 256 KB); replaces | `saved` (jsonb) |
| `POST /me/measurements` | `{ entries: [{ type, value, measuredAt }] }` → `{ added }`; types height, weight, chest, bust, waist, hips, inseam, armLength; dates from 2000 to tomorrow; appends, and resending is a no-op | `measurements` |
| `PUT /me/photo` | multipart `photo` (JPEG, PNG or WebP, ≤ 8 MB) → 204; stored upright, at most 480 px, ~30 KB JPEG without metadata; replaces. 400 `missing_photo`, 415 `unsupported_image_type`, 413 `file_too_large` | `profile_photos` (bytea) |
| `GET /me/photo` | → `image/jpeg` with an `ETag`; `If-None-Match` with it answers 304. 404 `no_photo` | |
| `GET /me` | → `{ profile, saved, measurements }` (newest 1000 measurements); the app restores from it after signing in on an empty install | |
| `DELETE /me` | Optional `{ appleAuthorizationCode }`. Revokes the Sign in with Apple token first when a code is sent and `APPLE_*` is set (a failed revocation is logged and the deletion goes ahead), then deletes the account through Supabase's admin API (`SUPABASE_SECRET_KEY`); the user's rows go with it, their events stay as anonymous counts. 503 `account_delete_unavailable` without the key, 502 `account_delete_failed` if Supabase refuses | |
| `POST /me/merge` | `{ anonymousToken }`, sent with the Apple/Google account's own token → `{ profile, saved, measurements }`. For a shopper whose Apple/Google identity already had an account, so linking the anonymous user failed: moves the anonymous user's data in (measurements added, the newer profile and photo win, the account's saved items win, events move), then deletes the anonymous user. 400 `invalid_merge` unless the body token is a valid anonymous login, different from the caller, and the caller isn't anonymous | |

**Memberships (RevenueCat).** With `REVENUECAT_SECRET_KEY` set (a RevenueCat secret API key), every `/catalog/*` route (the feed, product details and try-on images) answers only users whose RevenueCat `member` entitlement is active, including a billing grace period: others get 402 `membership_required`. The app logs purchases under the Supabase user id, so the server asks `GET https://api.revenuecat.com/v1/subscribers/{userId}` and keeps the answer 5 minutes for members and 30 s for non-members, so a new purchase gets in quickly (`src/services/membership.ts`). If RevenueCat can't answer (error or 3 s timeout), the request goes through and logs `membership_unavailable`. Sign-up, backups and selfie analysis come before the paywall, so they stay open. Without the key, everyone signed in gets in.

**Sign-in (Apple / Google through Supabase Auth).** Apple is enabled on the project with client ID `com.siloapp.ios` (native only: no secret), and manual identity linking is on, so the app links Apple/Google to the anonymous user (`supabase.auth.linkIdentity` with the ID token) and keeps the same user id and data. If the identity already has an account, the app signs in to it and calls `POST /me/merge`. Apple requires token revocation on account deletion: set `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY` (a Sign in with Apple key, `.p8`; `src/services/appleRevoke.ts`). Google needs its iOS and web client IDs on the project before it can be enabled.

Moving data after sign-up: `PUT /me/profile` (the new onboarding replaces any older profile), `POST /me/measurements` (added to the history), `PUT /me/saved`. A returning user who signs in on an empty install calls `GET /me` first and restores from it.

`POST /events` `{ events: [{ kind: "open" | "save" | "shop", itemId, season?, garment?, silhouette?, color? }] }` (≤ 100) records app actions in `events`; `color` is stored as its Shopify color family. 100 requests per user per 10 minutes, then 429 `rate_limited` (the app drops events that fail). `GET /catalog/discover?season=<id>` adds up the last 7 days for that season, counting each user once per item at their strongest action (shop 5, save 3, open 1), and marks matching products `popular: true` (same item, or the same garment, cut and color family as a top combination, each needing at least 6 points from at least 2 users, so one person can't make anything popular) and moves them to the front; the lookup gets 1.5 s, after which the page goes out without marks (`src/services/trends.ts`).

Tables come from `supabase/migrations/` (row level security on with no policies, so the app's publishable key can't read them; only the backend's database connection can). Logs carry counts only. Errors: 400 `invalid_request`, 401 `unauthorized`, 413 `too_large`, 502 `data_failed`.

## Attribution and limits

The metrics and cutoffs are adapted from the [Deep Seasonal Color Analysis System (DSCAS)](https://github.com/mrcmich/deep-seasonal-color-analysis-system) by Francesco Baraldi, Matteo Pagliani and GitHub user mrcmich. The upstream repository declares no license, so no DSCAS code or model weights are copied: only the published method is reimplemented.

- DSCAS's cutoffs come from its own segmentation network and color extraction on its own dataset. They are uncalibrated for Gemini-localized, box-sampled inputs.
- The spreads, weights, penalties, caps and sampling values are provisional team choices that need tuning on real photos.
- Results are not clinically or scientifically validated. Confidence is a heuristic, not a probability.
- Test across a range of skin tones and lighting before presenting recommendations with confidence. Boxes are not segmentation masks.
