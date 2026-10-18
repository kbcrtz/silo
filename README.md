# Silo

Color analysis, body measurements and fit, a feed ranked by your palette and shape, mannequin try-on, and saved lists. iOS app plus its backend.

| Folder | What | Start here |
| --- | --- | --- |
| [`frontend/`](frontend/) | iOS app: Expo SDK 55, expo-router, Skia | [`frontend/README.md`](frontend/README.md) |
| [`backend/`](backend/) | API server and data (TigerData) | [`backend/README.md`](backend/README.md) |

Run each side's commands from inside its own folder. App builds (`eas build`) run from `frontend/`; the root `.easignore` keeps `backend/` out of them.
