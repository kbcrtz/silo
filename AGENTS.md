# Silo repo

Two independent projects in one repo. Run every command from inside the folder it belongs to.

- `frontend/`: the iOS app. Read `frontend/AGENTS.md` before touching it.
- `backend/`: the API server. Read `backend/README.md`; its API contract is shared with `frontend/src/api/`.

Cross-cutting rules:
- An API shape change updates `backend/`, `frontend/src/api/` (including the mock) and both READMEs in the same change.
- Never import across the two folders; they share only the HTTP contract.
- The root `.easignore` replaces every `.gitignore` for EAS uploads. When adding ignore rules that matter for app builds, add them there too.
