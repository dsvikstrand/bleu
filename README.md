# Blueprints (`bleuV1`)

A React + Supabase app for turning media into bite-sized blueprints and discussing them with the community.

## Current Product Direction (`bleuV1`)
- Source-first: media ingestion is the primary content supply (YouTube first).
- Personal-first: users get a personal `My Feed` lane from pulled content.
- Community layer: channel feeds are shared lanes where users vote/comment/add insights.
- Gated distribution: channel publish is a second-step after quality/safety/channel-fit checks.

## Current Runtime Surfaces
- Home: `/`
- Feed: `/wall`
- Explore: `/explore`
- Channels: `/channels`
- Channel page: `/b/:channelSlug`
- YouTube adapter (manual v0): `/youtube`
- Blueprint detail: `/blueprint/:blueprintId`

## Tech Stack
- Vite + React + TypeScript
- Tailwind + shadcn/ui
- Supabase (auth, data, edge functions)
- Express agentic backend for generation/eval paths

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
