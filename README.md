# Blueprints (`bleuV1`)

A React + Supabase app for turning media into bite-sized blueprints and discussing them with the community.

## Current Product Direction (`bleuV1`)
- Source-first: media ingestion is the primary content supply (YouTube first).
- Personal-first: users get a personal `My Feed` lane from pulled content.
- Subscription-ready: users can follow YouTube channels, and new uploads are ingested automatically.
- Community layer: Home feed (`/wall`) is the shared lane where users vote/comment/add insights.
- Automated distribution: blueprints are auto-channeled and auto-published when checks pass; non-pass items stay in `My Feed`.

## Current Delivery Mode
- Active mode: manual iterative delivery.
- Loop: you propose change -> plan -> `PA` -> implementation -> validation.
- Agentic orchestration docs are retained as reference and are not the active delivery path.

## Current Runtime Surfaces
- Home: `/`
- Home feed: `/wall`
- Explore: `/explore`
- Channels: `/channels`
- Channel page: `/b/:channelSlug`
- YouTube adapter (manual v0): `/youtube`
- My Feed: `/my-feed`
- Subscriptions: `/subscriptions`
- Search: `/search`
- Profile: `/u/:userId` (`Feed / Comments / Liked`)
- Blueprint detail: `/blueprint/:blueprintId`

## Tech Stack
- Vite + React + TypeScript
- Tailwind + shadcn/ui
- Supabase (auth, data, edge functions)
- Express backend for generation/eval paths

## Local Development
```bash
npm install
npm run dev
```

## Key Commands
```bash
npm run build
npm run test
npm run docs:refresh-check -- --json
npm run docs:link-check
```

## Documentation Entry Point
Start with `docs/README.md`.
