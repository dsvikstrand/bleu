# Project - bleuV1 MVP Build (Manual Iterative)

Status: `active`

## Objective
Deliver the remaining `bleuV1` MVP through a manual iterative build loop with clear checkpoints and low ambiguity.

## Execution Scheme Reference
- Primary sequence and progress tracker:
  - `docs/exec-plans/active/bleuv1-manual-iteration-scheme.md`

## Active Delivery Protocol
1. User proposes a concrete update.
2. Assistant provides implementation plan (scope, touched files, validation).
3. User approves with `PA`.
4. Assistant implements and validates.
5. Assistant reports outcomes and follow-up options.

## Operating Mode
- Active mode: manual iterative execution.
- Paused mode: multi-agent orchestration automation.
- Agentic docs remain as reference contracts only and are not mandatory for each feature iteration.

## Product Defaults (Locked)
1. YouTube-only adapter scope for MVP.
2. My Feed default visibility is personal/private until channel promotion.
3. Channel promotion default mode is classifier-driven auto-publish after checks.
4. User value-add is insight/remix on imported blueprints; no standalone free-form post model in MVP core.
5. Non-pass auto-channel outcomes are blocked from channel and retained in My Feed.
6. Legacy manual gate runtime remains `CHANNEL_GATES_MODE=bypass`; auto-channel path uses `AUTO_CHANNEL_GATE_MODE`.

## Current Workstreams
### W1 - My Feed As First-Class Surface
- Introduce/finish personal unfiltered feed lane behavior.
- Keep `My Feed` as a profile-oriented workspace surface (profile `Feed` tab) instead of a top-nav primary.
- Ensure channel fail does not remove personal access.
- Hide legacy no-blueprint pending/skipped rows during migration cleanup.
- Align My Feed card presentation to channel-feed style and show read-only auto-channel status labels.
- Normalize My Feed blueprint badges to `Blueprint` and align feed tag chips with Home one-row capped rendering (no `#` prefix).
- Show `Posted to <Channel>` only for channel-published items; held/rejected items remain visible as `In My Feed` without technical reason copy.
- Ensure full-card banner fill on My Feed blueprint cards (no transparent edge gap).
- Harden Search-generated source channel-title persistence + metadata fallback so My Feed subtitle row consistently shows channel name.
- Keep imported blueprint detail attribution source-first (show source channel when present, hide default edit CTA in MVP UI).
- Profile privacy default migration: new profiles default to public (`profiles.is_public=true`), existing profiles unchanged.
- Main nav IA is simplified to `Home / Channels / Explore`, with search/create moved to the header `Create` action.
- Core high-traffic copy is harmonized to current source-first behavior (`Home`, `Create`, auto-channel publish) and legacy manual-post phrasing is removed.

### W2 - Channel Candidate Gating
- Run deterministic auto-channel checks for all source paths.
- Preserve quality/safety/channel-fit constraints while keeping legacy manual endpoints as rollback-safe fallback.
- Use deterministic tag+alias classifier for real channel resolution with `general` fallback, and keep channel-fit gate logic aligned with the same mapper.
- Add rollout-ready `llm_labeler_v1` classifier mode (artifact-only sync labeling with retry-once then `general` fallback) without schema churn.

### W3 - YouTube Pull And Caching
- Keep YouTube-first ingestion flow stable.
- Reuse generated artifacts for duplicate pulls when canonical source id matches.
- Keep optional review/banner enhancement as separate post-generation steps to reduce core latency bottlenecks.
- `/youtube` now forces core-first endpoint payload (`generate_review=false`, `generate_banner=false`) and runs optional enhancement attach asynchronously.
- `Save to My Feed` is non-blocking during optional post-steps; late review/banner can attach to already-saved blueprints.
- Backend timeout budget for core endpoint is configurable via `YT2BP_CORE_TIMEOUT_MS` (default `120000`).
- Banner prompt path is hardened for visual-only output so generated backgrounds avoid readable text overlays.
- Async auto-banner queue path is now available for subscription auto-ingest, preserving ingestion speed and applying banners later.

### W4 - Community Value Layer
- Keep insights/remixes tied to imported blueprints.
- Maintain vote/comment utility on shared channel content.

### W5 - Subscription Intake And Sync
- Support YouTube channel subscriptions with auto-only MVP UX.
- First subscribe sets checkpoint only (new-uploads-only, no historical prefill).
- Insert persistent `subscription_notice` item in My Feed per subscribed channel.
- Add `/subscriptions` page as first-class management surface (Step 1 foundation + Step 2 simplification).
- Step 2 simplified actions on `/subscriptions`: active-list `Unsubscribe` only (sync/reactivate UI deferred).
- Step 3 reliability pass adds `/subscriptions` health summary/badges and delayed-warning trust signals.
- Step 4 discovery pass adds auth-only channel search in `/subscriptions` with per-result `Subscribe` (popup flow, manual paste removed).
- Step 5 row polish adds optional channel avatars and removes technical row badges from subscription rows.
- Step 6 UX simplification removes aggregate ingestion summary card from `/subscriptions` while keeping unsubscribe and row-level signals.
- Step 7 My Feed notice polish adds avatar/banner notice rendering and confirm-gated unsubscribe that removes notice cards from My Feed.
- Step 8 My Feed interaction cleanup adds simpler copy, direct `Add Subscription`, card-click blueprint opening, and compact notice-card actions.
- Step 9 My Feed status-row refinement adds subscription details popup and footer-driven post-to-channel actions.
- Step 10 async auto-banner policy adds queue processing (`auto_banner_jobs`) and generated-banner cap fallback with deterministic channel defaults.
- Step 11 manual refresh adds `/subscriptions` scan popup + selected async background generation for new subscription videos.
- Step 12 gotcha hardening adds refresh rate caps, manual-job concurrency lock, failed-video cooldown suppression, and lightweight background job status on `/subscriptions`.
- Step 13 refresh hardening follow-up advances manual refresh checkpoints forward, adds reload-safe latest-user-job restore, and surfaces cooldown-filtered counts in scan UI.
- Step 14 polish pass simplifies subscription popup/list copy and moves channel-open affordance to avatar click.
- Step 15 IA refinement adds `Subscriptions` shortcut in user dropdown and owner-only lightweight `Subscriptions` tab in profile workspace.
- Added service-ops endpoint `GET /api/ingestion/jobs/latest` for latest ingestion status checks.
- Added user endpoint `GET /api/ingestion/jobs/:id` for owner-scoped manual refresh progress.
- Added user endpoint `GET /api/ingestion/jobs/latest-mine` for owner-scoped latest refresh-job restore after page reload.
- Keep sync/deactivate and pending accept/skip endpoints as compatibility/operator paths.
- Keep debug simulation endpoint env-gated (`ENABLE_DEBUG_ENDPOINTS`) for non-prod ingestion testing.
- Debug simulation auth contract: `x-service-token` only (no user bearer required).
- Handle resolution hardening: parse YouTube `browseId` fallback for handle URLs that omit explicit `channelId` metadata.
- Run scheduler trigger from Oracle (`/api/ingestion/jobs/trigger` with service auth).

### W6 - Search Discovery (YouTube)
- Add auth-only `/search` route for query-based discovery.
- Use header `Create` action (next to profile menu) as the primary entrypoint to `/search`.
- Add backend endpoint `GET /api/youtube-search` (YouTube Data API provider).
- Keep results transient until explicit `Generate Blueprint`.
- Enable per-result one-click `Subscribe Channel` with existing idempotent subscription API.
- Keep direct URL route `/youtube` as fallback and unchanged baseline.

## Acceptance Baseline Per Iteration
1. Scope and behavior align with `docs/app/product-spec.md`.
2. Architecture assumptions remain aligned with `docs/architecture.md`.
3. Docs freshness check passes:
- `npm run docs:refresh-check -- --json`
4. Docs link check passes:
- `npm run docs:link-check`
5. Additional validation is run when change risk requires it.

## Checkpoint Policy (Manual)
- CP1: identity/scope changes (one-line promise, in/out-of-scope shifts).
- CP2: policy/data/auth boundary changes.
- CP3: milestone close where multiple dependent tasks converge.

## Deferred (On Hold)
- `codex exec` orchestration scripts and role runner wrappers.
- CI workflow implementation for evaluator/integrator automation.
- Automated checkpoint enforcement.
- Production gate enforcement (`CHANNEL_GATES_MODE=enforce`).

## Reference Material (Paused Track)
- `docs/agentic/README.md`
- `docs/agentic/foundation/`
- `docs/agentic/executable/`

## Completion Criteria For This Plan
1. Remaining MVP work is shipped through manual iterations without identity drift.
2. Core product contract remains stable and understandable in one sentence.
3. Deferred automation work can be resumed later without blocking MVP delivery.
