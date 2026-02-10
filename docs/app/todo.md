# TODO (MVP Gotchas / Tech Debt)

This is a running list of MVP-facing risks and tech debt discovered during repo review.

## Backend (Oracle / Express)

- [ ] **P0: Tighten CORS default**
  Impact: If `CORS_ORIGIN` is not set, backend allows `*`. Even with auth, it increases attack surface and makes future tightening harder.
  Where: `server/index.ts`

- [ ] **P0: Narrow `trust proxy`**
  Impact: `app.set('trust proxy', true)` can allow client spoofing of `X-Forwarded-For` if requests can bypass Nginx, affecting logs and IP-based controls.
  Where: `server/index.ts`

- [ ] **P1: Credits/rate-limit persistence is file-based**
  Impact: `server/data/ai-usage.json` is fine for one server, but can reset/duplicate under multiple processes and grows over time.
  Where: `server/credits.ts`, `server/data/ai-usage.json` (runtime)

- [ ] **P1: JSON request size limit may be too small**
  Impact: `express.json({ limit: '1mb' })` can break larger blueprints/inventories or future payloads (steps, items, metadata).
  Where: `server/index.ts`

## Analytics / Logging

- [ ] **P0: Anonymous event logging can be spammed**
  Impact: When logged out, the frontend sends `Authorization: Bearer ${VITE_SUPABASE_PUBLISHABLE_KEY}` to `functions/v1/log-event`.
  If the edge function accepts it, anyone can inflate metrics and increase DB write load/cost.
  Where: `src/lib/logEvent.ts` (client behavior), Supabase Edge `log-event` (server behavior)

## Frontend / Product Scope

- [ ] **P1: Remove/disable deprecated Remix route**
  Impact: Extra MVP surface area that can confuse users and adds maintenance. You previously said remix is not needed for MVP.
  Where: `src/App.tsx` (route `/blueprint/:blueprintId/remix`), `src/pages/BlueprintRemix.tsx`

## Deploy / Ops

- [ ] **P1: GitHub Pages deploy keeps old files**
  Impact: `keep_files: true` can accumulate stale assets and make cache/debugging harder over time.
  Where: `.github/workflows/pages.yml`

- [ ] **P1: Multiple lockfile signal (npm vs bun)**
  Impact: `bun.lockb` exists, but CI uses `npm ci`. This can confuse contributors and automation about the source-of-truth package manager.
  Where: `bun.lockb`, `package-lock.json`, `.github/workflows/pages.yml`

