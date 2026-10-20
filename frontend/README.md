# Silo app

iOS app (Expo SDK 55, expo-router) for color analysis, body measurements and fit, a Pinterest-style feed ranked by your palette and body shape, try-on on a mannequin built from your measurements, and saved lists.

The frontend runs on mocks unless a backend URL is set: color analysis and the catalog are faked in `src/api/`, and size charts are fixtures in `src/data/`. With the backend, the feed shows live Shopify listings (`src/hooks/useDiscover.ts`) and Shop opens the merchant's own page; in mock mode it shows the bundled demo items, labeled "demo catalog", and Shop opens a shopping search. `src/api/tryOn.ts` (AI try-on on a body photo) is kept for later but nothing calls it now.

## Run it

You need Xcode and CocoaPods (`brew install cocoapods`). Silo uses a dev client, not Expo Go. Run everything below from this `frontend/` folder.

```sh
cd frontend
npm install
cp .env.template .env
npm run ios        # builds the dev client and installs it on a simulator (first build takes a few minutes)
npm start          # later runs: just start Metro and open the installed app
```

Rebuild (`npm run ios`) only after adding a native package or changing `app.json`. JS changes reload over Metro.

In the app, **Use demo profile** on the welcome screen (or **Load demo profile** on the Profile screen) skips onboarding with a finished Soft Autumn profile and measurement history.

## Building for phones (EAS)

One-time setup, from `frontend/` (needs the paid Apple Developer account, and `brew install fastlane cocoapods`):

1. `eas login`, then `eas init`. This writes `extra.eas.projectId` and `owner` into `app.json`.
2. Register every phone **before** the first device build: `eas device:create`, send the link/QR to each teammate, confirm with `eas device:list`. Device ids are baked into the provisioning profile.
3. On each phone: Settings → Privacy & Security → Developer Mode on.

Builds:

| Command | What you get |
| --- | --- |
| `eas build -p ios --profile development --local` | Dev client `.ipa` for registered phones; loads JS from Metro |
| `eas build -p ios --profile simulator --local` | Dev client for the simulator; no Apple credentials needed |
| `eas build -p ios --profile preview --local` | Release build with JS bundled in; use this for the demo (no Metro or Wi-Fi needed) |

The first device build asks you to sign in to Apple and creates the bundle id (`com.siloapp.ios`), distribution certificate and ad-hoc profile. Install the `.ipa` by dragging it into Xcode → Window → Devices and Simulators, or `xcrun devicectl device install app --device <id> <file>.ipa`.

- Adding a phone later means registering it and rebuilding.
- Teammates who aren't with you: drop `--local` for a cloud build with an install link, or `eas submit -p ios` a preview build to TestFlight internal testers.

## Connecting the backend

Set `EXPO_PUBLIC_API_URL` and `EXPO_PUBLIC_USE_MOCKS=false` in `.env`, plus `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` for sign-in (EAS builds don't upload `.env`: set the same values as EAS environment variables). Until Apple and Google sign-in exist, `src/api/supabase.ts` signs in silently at launch as an anonymous Supabase user (the project must allow anonymous sign-ins), and the root layout waits for it, up to 8 s, before the app talks to the server. The server lives in [`../backend`](../backend/README.md). Signed in, requests send `Authorization: Bearer <Supabase access token>`: the sign-in code passes the session's token to `setAccessToken` in `src/api/config.ts` on sign-in, refresh and sign-out (null). Logged out, only selfie analysis reaches the server; every other route answers 401 `unauthorized`. The app expects:

- `POST /color-analysis`, multipart `selfie` → `{ warmth, depth, clarity, confidence }` (axes -1..1, see `src/data/seasons.ts`)
- `POST /try-on`, multipart `bodyPhoto`, `itemId`, `itemImageUrl?`, `measurements` (JSON, cm/kg) → `{ jobId }`
- `GET /try-on/:jobId` → `{ status: "queued" | "running" | "succeeded" | "failed", resultUrl?, error? }`
- `GET /catalog/discover?category&q&shopFor&style&palette&neutrals&priceMin&priceMax&cursor` → `{ products, cursor, source }`, live Shopify listings (`src/api/catalog.ts`). The mock serves the bundled fixtures as `source: "demo"`. `src/lib/liveItem.ts` turns each listing into a catalog item. Its color and cut come from the backend's `estimate` (Gemini reading the listing text) when present, else from the color name and a title guess; the item sheet says the cut is estimated. The feed is kept in memory only; a live product the user saves is kept as a small bookmark (title, store and image links, price label, cut) in `src/store/saved.ts`, so saved lists survive a restart.
- `GET /catalog/tryon-image?id&shopFor` → JPEG: on a live product, Try it on shows this AI image (the item alone on a bare mannequin, `src/components/AiTryOn.tsx`) instead of the drawn mannequin, which stays for demo items, mock mode and as the fallback if generation fails.
- `PUT /me/profile`, `PUT /me/saved`, `POST /me/measurements`, `GET /me`, `DELETE /me` (signed in only, `src/api/userData.ts`): onboarding runs logged out with everything on the phone. After sign-up the app sends the profile (without the selfie), measurements and saved items; `src/hooks/useCloudSync.ts` then keeps them current two seconds after each change, and the phone stays the source of truth. Logged out, these calls do nothing. A returning user who signs in on an empty install is restored from `GET /me` before backups start. `deleteAccount()` calls `DELETE /me`, which deletes the account and its data. Opens, saves and Shop taps are reported to `POST /events` in batches (`track`), and the feed sends the season id so popular items come back marked "Popular".
- Real sign-in (Apple and Google through Supabase Auth, linked to the anonymous user; the sign-up step after the passport; sign-out and account deletion in Profile) isn't built yet; see `docs/superpowers/specs/2026-10-19-supabase-auth-design.md` on the team machine for the plan. `useCloudSync` runs once at startup, so it must run again when the signed-in user changes.

## How the app is laid out

One home screen, the feed. Its top bar opens **Saved** (left) and **Profile** (right); tapping an item opens a sheet with **Try it on** (the item drawn on your mannequin), **Save** (then add it to any of your lists) and **Shop**. Onboarding ends on the passport, with a first look at your picks.

## Folders

```
src/app/          routes: index (home feed), item/[id] (sheet), saved/, profile, measurements, onboarding/*
src/api/          backend calls, each with a mock
src/lib/          pure logic: color math, color analysis, palette match, body shape, silhouette, recommend, mannequin, fit, units
src/data/         seasons/palettes, catalog, size charts, demo profile
src/store/        zustand stores persisted to AsyncStorage
src/theme/        theme built at runtime from the user's season
src/hooks/        shared hooks (ranked feed, latest measurements)
src/components/   shared UI; Mannequin is the Skia try-on figure, passport/ the holo passport card
```

## Checks

```sh
npm run typecheck
npm test
npx expo-doctor
```
