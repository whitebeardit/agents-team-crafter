# AGENTS.md

## Cursor Cloud specific instructions

### Services overview

| Service | Port | Dev command | Notes |
|---------|------|-------------|-------|
| MongoDB | 27017 | `sudo mongod --dbpath /data/db --fork --logpath /var/log/mongodb/mongod.log` | Must be running before backend starts. |
| Backend (Fastify BFF) | 3001 | `cd backend && npm run dev` | Requires `backend/.env` with `MONGODB_URI` and `JWT_SECRET`. |
| Frontend (Next.js) | 3000 | `cd v0-team-ai-crafter && PORT=3000 npm run dev` | Requires `v0-team-ai-crafter/.env.local` with `NEXT_PUBLIC_*` vars. |

### Startup order

1. Start MongoDB first.
2. Start the backend (`npm run dev` in `backend/`).
3. Start the frontend (`PORT=3000 npm run dev` in `v0-team-ai-crafter/`). **Important:** Next.js 16 auto-increments the port if 3000 is busy; always set `PORT=3000` explicitly to avoid stealing the backend's port 3001.

### Environment files

- `backend/.env` — copy from `backend/.env.example`. For local dev, use `MONGODB_URI=mongodb://127.0.0.1:27017/teamagents`.
- `v0-team-ai-crafter/.env.local` — copy from `v0-team-ai-crafter/.env.example`. Set `NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1`.

### Seed data

Run `cd backend && npm run seed` to create the demo admin user. Login: **admin@whitebeard.dev** / **Admin123!**.

### Lint, test, and build

- **Backend lint:** `cd backend && npm run lint`
- **Backend tests:** `cd backend && npm test` (uses `mongodb-memory-server` — no external MongoDB needed for tests)
- **Backend build:** `cd backend && npm run build`
- **Frontend lint:** `cd v0-team-ai-crafter && npm run lint`
- **Frontend build:** `cd v0-team-ai-crafter && npm run build`
- **Frontend E2E:** see `v0-team-ai-crafter/README.md` (Playwright, requires both servers running)

### Gotchas

- Redis is **optional** for local dev; the Chat SDK and governance rate limiter fall back to in-memory state.
- `OPENAI_API_KEY` is only needed to test AI agent execution features (team plans, runtime). Core CRUD and UI work without it.
- A few backend integration tests may intermittently fail due to `mongodb-memory-server` timing; this is a known flaky-test issue, not an environment problem.
