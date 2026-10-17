# Silo backend

Server for the Silo app: color analysis, try-on generation, and later measurement sync and recommendations. Planned data store: TigerData (Postgres with TimescaleDB for measurement history and pgvector for recommendations).

Pick the stack and fill in how to run it here. Keep everything backend-specific inside this folder (its own `package.json` / `pyproject.toml`, `.gitignore`, `.env`).

## API contract

The app already calls these, behind mocks, in `frontend/src/api/`. Match these shapes; when they change, update `frontend/src/api/` and `frontend/README.md` in the same change.

- `POST /color-analysis`, multipart `selfie` → `{ warmth, depth, clarity, confidence }`. Axes are -1..1, confidence 0..1; the axes are defined in `frontend/src/data/seasons.ts`.
- `POST /try-on`, multipart `bodyPhoto` (file), `itemId`, `itemImageUrl?`, `measurements` (JSON, cm/kg) → `{ jobId }`
- `GET /try-on/:jobId` → `{ status: "queued" | "running" | "succeeded" | "failed", resultUrl?, error? }`

To point the app at a running server, set `EXPO_PUBLIC_API_URL` and `EXPO_PUBLIC_USE_MOCKS=false` in `frontend/.env`. A phone needs your machine's LAN IP, not `localhost`.
