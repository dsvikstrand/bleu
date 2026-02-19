# Core Direction Lock (`bleuV1`)

Status: `canonical`

## One-line promise
`bleuV1` gives you an automated feed of bite-sized blueprints from the media you follow, with automatic channel publishing for eligible items.

## Locked core (MVP)
1. Source-first product identity.
2. YouTube is the only required adapter in MVP.
3. `My Feed` is the personal default lane.
4. Home feed (`/wall`) is automatically populated from `My Feed` via auto-channel checks.
5. Community value is comments/votes/insights on blueprint content.
6. Channel routing mode is env-driven (`deterministic_v1` default, `llm_labeler_v1` optional) and falls back to `general` on ambiguous/invalid label output.
7. Feed/detail surfaces prioritize source-channel context for imported media over creator-edit workflows in MVP UI.
8. Profile visibility is public-by-default for new accounts (`profiles.is_public=true` default); existing privacy choices remain respected.
9. My Feed blueprint card badge label is normalized to `Blueprint`, and feed tags use the same one-row capped chip treatment as Home (without `#` prefix).
10. Signed-in primary nav is `Home / Channels / Explore`; search/create entrypoint is the header `Create` action to `/search`.
11. Subscriptions are reachable from both user dropdown (full page) and profile workspace owner tab (lightweight list).
12. Core high-traffic UI copy must use current runtime language (`Home`, `Create`, auto-channel publish) and avoid legacy manual-post wording.
13. `/subscriptions` is the only entrypoint for YouTube OAuth connect + bulk import in MVP; signup-step integration is deferred.
14. YouTube disconnect revokes+unlinks OAuth tokens but preserves existing app subscriptions.
15. Import selection defaults to none-selected, and import is idempotent with inactive-row reactivation.
16. New-account optional onboarding uses `/welcome` as a first-login setup entrypoint; existing accounts are not auto-prompted.
17. Onboarding completion requires successful subscription import (connect-only is insufficient).
18. Source identity is moving to platform-agnostic `Source Pages` (`/s/:platform/:externalId`), with YouTube channel `UC...` as the current canonical key.
19. Source pages are public-readable and subscribe/unsubscribe capable; legacy `/api/source-subscriptions*` endpoints remain compatibility-safe during migration.

## Core user journey
1. Subscribe to a YouTube channel or search/select a video.
2. Generate/import blueprint into `My Feed`.
3. System auto-evaluates and posts eligible blueprints to channels.
4. Engage through community interactions in Home feed.
5. Use profile workspace (`/u/:userId`) tabs `Feed / Comments / Liked / Subscriptions` for personal history; `/my-feed` remains a compatibility/direct route.

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
