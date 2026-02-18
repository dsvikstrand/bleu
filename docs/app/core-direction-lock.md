# Core Direction Lock (`bleuV1`)

Status: `canonical`

## One-line promise
`bleuV1` gives you an automated feed of bite-sized blueprints from the media you follow, with automatic channel publishing for eligible items.

## Locked core (MVP)
1. Source-first product identity.
2. YouTube is the only required adapter in MVP.
3. `My Feed` is the personal default lane.
4. Channel feed is automatically populated from `My Feed` via deterministic auto-channel checks.
5. Community value is comments/votes/insights on blueprint content.
6. Deterministic channel routing resolves real curated channels from tags/aliases and falls back to `general` when ambiguous.

## Core user journey
1. Subscribe to a YouTube channel or search/select a video.
2. Generate/import blueprint into `My Feed`.
3. System auto-evaluates and posts eligible blueprints to channels.
4. Engage through community interactions in channel feed.

## What is not core right now
1. Library-first creation is deprecated as primary identity.
2. Legacy inventory/library routes remain compatibility paths only.
3. Multi-adapter rollout (PDF/audio/etc.) is deferred.

## Deprecation policy
1. Keep compatibility routes/components until post-MVP cleanup.
2. Do not market or position library flow as primary product path.
3. If docs conflict on identity, this file + canonical docs win.

## Canonical references
- Product: `docs/app/product-spec.md`
- Architecture: `docs/architecture.md`
- Active program: `docs/exec-plans/active/bleuv1-source-first-program.md`
- Runbook: `docs/ops/yt2bp_runbook.md`
