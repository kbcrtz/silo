# Silo

iOS app (Expo SDK 55, expo-router) for color analysis, body measurements and fit, a Pinterest-style feed ranked by your palette, and AI try-on.

The frontend runs fully on mocks until the backend exists: color analysis and try-on generation are faked in `src/api/`, and the catalog and size charts are fixtures in `src/data/`.

## Run it

You need Xcode and CocoaPods (`brew install cocoapods`). Silo uses a dev client, not Expo Go.

```sh
npm install
cp .env.template .env
npm run ios        # builds the dev client and installs it on a simulator (first build takes a few minutes)
npm start          # later runs: just start Metro and open the installed app
```

Rebuild (`npm run ios`) only after adding a native package or changing `app.json`. JS changes reload over Metro.

In the app, **Use demo profile** on the welcome screen (or **Load demo profile** on the Me tab) skips onboarding with a finished Soft Autumn profile and measurement history.

## Building for phones (EAS)

One-time setup (needs the paid Apple Developer account, and `brew install fastlane cocoapods`):

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

Set `EXPO_PUBLIC_API_URL` and `EXPO_PUBLIC_USE_MOCKS=false` in `.env`. The app expects:

- `POST /color-analysis`, multipart `selfie` → `{ warmth, depth, clarity, confidence }` (axes -1..1, see `src/data/seasons.ts`)
- `POST /try-on`, multipart `bodyPhoto`, `itemId`, `itemImageUrl?`, `measurements` (JSON, cm/kg) → `{ jobId }`
- `GET /try-on/:jobId` → `{ status: "queued" | "running" | "succeeded" | "failed", resultUrl?, error? }`

## Layout

```
src/app/          routes: (tabs) Discover / Try On / Me, onboarding/*, item/[id], result/[id], measurements
src/api/          backend calls, each with a mock
src/lib/          pure logic: color math, color analysis, palette match, body shape, fit, units, photos
src/data/         seasons/palettes, catalog, size charts, demo profile
src/store/        zustand stores persisted to AsyncStorage
src/theme/        theme built at runtime from the user's season
src/components/   shared UI
```

## Checks

```sh
npm run typecheck
npm test
npx expo-doctor
```
