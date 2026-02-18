# bleuV1 Manual Iteration Scheme

Status: `active`

## Purpose
This document is the step-by-step execution scheme for the remaining `bleuV1` MVP work.

Execution mode:
- manual iterative loop only
- one step completed before the next starts
- each step uses plan -> `PA` -> implementation -> evaluation -> closeout

## Global Rules
1. Do not start a new step until the current step is validated.
2. Every step must define clear acceptance evidence.
3. If validation fails, fix in the same step before moving on.
4. Keep identity stable: source-first, My Feed first, auto-channel publish with rollback-safe legacy path.

## Step Tracker
1. [have] Step 0 - Contract lock and naming alignment
2. [have] Step 1 - Source adapter foundation (`BaseAdapter` + `YouTubeAdapter`)
3. [have] Step 2 - My Feed as pulled-content lane
4. [have] Step 3 - Submit flow (`My Feed` -> channel candidate)
5. [have] Step 4 - Gate pipeline contract (runtime currently bypass default)
6. [have] Step 5 - Channel publish/reject outcomes
7. [have] Step 6 - Library deprecation pass (soft)
8. [have] Step 7 - Observability baseline
9. [have] Step 8 - Hardening cycle: docs realignment + CTA de-emphasis + traceability + gate-mode framework
10. [have] Step 9 - Subscriptions and auto-ingestion cycle (auto new uploads + compatibility pending actions)
11. [have] Step 10 - MVP subscription simplification (auto-only UX + no prefill + notice cards)
12. [have] Step 11 - Subscriptions page foundation (add + read-only active/inactive)
13. [have] Step 12 - Subscriptions management simplification (subscribe/unsubscribe only)
14. [have] Step 13 - Ingestion reliability visibility (health signals + latest job endpoint)
15. [have] Step 14 - YouTube Search-to-Blueprint (auth-only `/search` with generate + subscribe)
16. [have] Step 15 - Subscription channel search (auth-only `/subscriptions` discovery + subscribe)
17. [have] Step 16 - Subscription row polish (avatar enrichment + hide technical row badges)
18. [have] Step 17 - Feed UX polish (hide ingestion summary + My Feed `+` submit popup + review/banner defaults)
19. [have] Step 18 - Async auto-banner queue + global cap fallback policy
20. [have] Step 19 - My Feed card copy refinement + search channel-context subtitle handoff
21. [have] Step 20 - Search channel-title persistence hardening for My Feed subtitle row
22. [have] Step 21 - `/youtube` core-first async attach + timeout control hardening
23. [have] Step 22 - Subscription manual refresh popup + async selected generation
24. [have] Step 23 - Refresh/poll gotcha hardening (caps + cooldown + job status)
25. [have] Step 24 - Refresh checkpoint + reload-resume hardening
26. [have] Step 25 - Auto-channel pipeline cutover (general-first deterministic publish)
27. [have] Step 26 - Deterministic real-channel classification (tag+alias mapper with `general` fallback)
28. [have] Step 27 - Two-step LLM channel labeler (post-artifact sync, retry+fallback)
29. [have] Step 28 - Attribution + subscription-surface cleanup (source-channel-first detail header and simplified subscription UI)
30. [have] Step 29 - Home naming + profile-oriented nav (`/wall` labeled Home, `My Feed` moved to user menu)
31. [have] Step 30 - Profile workspace tabs (`Feed / Comments / Liked`) + dropdown cleanup

Interpretation note
- Step entries capture execution timeline.
- Some early completed steps describe intermediate states that were later refined by newer steps.
- For current runtime behavior, use canonical docs: `docs/app/product-spec.md`, `docs/architecture.md`, and `docs/ops/yt2bp_runbook.md`.

## Step Definitions
### Step 0 - Contract lock and naming alignment
Scope
- align docs and UI naming around `My Feed`, `Channel Candidate`, `Channel Publish`
- ensure lifecycle language is consistent across canonical docs

Definition of done
- naming drift removed from active docs
- lifecycle wording matches product/architecture docs
- docs checks pass

Evaluation
- `npm run docs:refresh-check -- --json`
- `npm run docs:link-check`

### Step 1 - Source adapter foundation (`BaseAdapter` + `YouTubeAdapter`)
Scope
- define adapter abstraction and registry
- route existing YouTube pull through `YouTubeAdapter`

Definition of done
- URL pull runs through adapter interface
- canonical key strategy for YouTube is explicit and used

Evaluation
- manual pull smoke test works through adapter path
- duplicate pull behavior remains stable

### Step 2 - My Feed as pulled-content lane
Scope
- ensure pulled content lands in personal lane first
- represent feed item state for personal stage

Definition of done
- pulled item visible in `My Feed`
- personal feed does not require channel publication

Evaluation
- manual test: pull URL -> `My Feed` entry appears

### Step 3 - Submit flow (`My Feed` -> channel candidate)
Scope
- add explicit submit action from personal feed
- create or update candidate state idempotently

Definition of done
- one candidate per intended item/channel path
- duplicate submit retries do not create spam duplicates

Evaluation
- manual test: submit action creates expected candidate state

### Step 4 - Gate pipeline (pluggable gates)
Scope
- define gate interface and execution order
- run channel-fit, quality, safety, pii gates in pipeline

Definition of done
- all-gates-run behavior is enforced
- pass/warn/block route to the correct next state

Evaluation
- scenario checks for pass/warn/block outcomes

### Step 5 - Channel publish/reject outcomes
Scope
- publish candidates on pass
- reject candidates on fail and preserve personal visibility

Definition of done
- channel feed reflects publish decisions
- rejected candidate remains in `My Feed`

Evaluation
- manual test for publish and reject branches

### Step 6 - Library deprecation pass (soft)
Scope
- keep library code paths in repo
- de-emphasize or hide library-first UX in MVP journey

Definition of done
- primary user path no longer depends on library flow
- no destructive removal of library code/data contracts

Evaluation
- navigation and copy review for legacy leakage

Completion evidence (2026-02-17)
- Home/About/Help/Glossary/Explore copy now frames legacy library flows as compatibility-only.
- Primary CTA journey is source pull -> My Feed -> submit to channel.
- No destructive library route/component removals were made.

### Step 7 - Observability and hardening
Scope
- add trace events/log markers for pull, submit, gate, publish
- tighten failure visibility and triage clues

Definition of done
- one content item can be traced end-to-end in logs
- reason code visibility exists for channel rejection

Evaluation
- smoke script or log review demonstrates full path traceability

Completion evidence (2026-02-17)
- Telemetry events in active flow now include:
  - `source_pull_requested`
  - `source_pull_succeeded`
  - `my_feed_publish_succeeded`
  - `candidate_submitted`
  - `candidate_gate_result`
  - `candidate_manual_review_pending`
  - `channel_publish_succeeded`
  - `channel_publish_rejected`
- Backend evaluate endpoint emits deterministic gate-result and manual-review log markers with reason codes.

### Step 8 - Hardening cycle (gate bypass retained)
Scope
- align docs with runtime reality (bypass-first gate mode)
- remove library-first CTAs from top-level flow
- improve end-to-end traceability keys
- introduce gate-mode framework (`bypass|shadow|enforce`) without changing prod behavior

Definition of done
- active docs do not claim enforced gates are running in production
- primary CTAs route through YouTube/My Feed path
- publish/reject actions emit structured logs with trace IDs
- default gate mode remains bypass and matches frontend fallback semantics

Evaluation
- `npm run docs:refresh-check -- --json`
- `npm run docs:link-check`
- `npm run build`
- manual smoke: YouTube -> My Feed -> submit -> publish/reject

### Step 9 - Subscriptions and auto-ingestion
Scope
- add YouTube source subscriptions and ingestion sync loop
- add sync trigger endpoints (`user sync` and service cron trigger)
- keep pending-card lifecycle endpoints in compatibility scope (`accept|skip`)

Definition of done
- subscriptions ingest only new uploads after checkpoint
- first subscribe establishes checkpoint and avoids old-video prefill
- compatibility pending card accept remains idempotent when legacy pending items exist
- ingestion jobs are traceable via `ingestion_jobs` table + logs

Evaluation
- manual smoke: subscribe -> checkpoint set with no backfill
- manual smoke: future uploads sync to published
- regression smoke: YouTube URL pull and channel submit/publish still work

### Step 10 - MVP subscription simplification
Scope
- simplify My Feed subscription UX to one action: `Add Subscription`
- remove inline subscription management controls from My Feed
- add persistent informational notice card per subscribed channel

Definition of done
- My Feed no longer shows inline mode/sync/deactivate controls
- Add Subscription opens floating dialog with channel input only
- successful subscribe creates one `subscription_notice` feed card per user/channel
- legacy `manual` subscription rows are migrated to `auto`

Evaluation
- manual smoke: subscribe once -> one notice card appears
- manual smoke: repeat subscribe -> no duplicate notice cards
- regression smoke: channel submit/publish flow still works

Completion evidence (2026-02-18)
- One-time cleanup removed legacy no-blueprint skipped/pending test rows.
- `My Feed` now filters legacy no-blueprint pending/skipped rows by default.
- Added debug-only subscription simulation endpoint to test new-upload ingestion without waiting for real channel uploads.
- Fixed debug endpoint auth boundary so service-token-only calls can pass middleware without user bearer auth.
- Fixed YouTube handle resolver edge case by adding `browseId` fallback parsing (prevents false `INVALID_CHANNEL` on some handles).

### Step 11 - Subscriptions page foundation
Scope
- add first-class `/subscriptions` page for subscription creation and visibility
- keep subscription list read-only (active/inactive sections)
- keep My Feed content-first by moving management surface out of My Feed

Definition of done
- `/subscriptions` route exists behind same auth + feature gate as `/my-feed`
- page supports create subscription + read-only active/inactive listing
- My Feed header exposes only compact `Manage subscriptions` entrypoint
- no row-level actions (`sync`, `deactivate`, debug simulate`) in this step

Evaluation
- manual smoke: open `/subscriptions` while signed in
- manual smoke: subscribe and verify row appears in Active list
- manual smoke: My Feed shows compact management link and no large subscription modal
- regression smoke: notice card still appears in My Feed after subscribe

Completion evidence (2026-02-17)
- Added `src/pages/Subscriptions.tsx` with add form + read-only active/inactive sections.
- Added protected `/subscriptions` route in `src/App.tsx` gated by `config.features.myFeedV1`.
- Replaced My Feed header modal action with compact `Manage subscriptions` link.

### Step 12 - Subscriptions management actions
Scope
- simplify `/subscriptions` to one management action (`Unsubscribe`) without changing backend contracts
- keep `/subscriptions` URL-access only (no nav item in this step)
- keep page focused on active subscriptions only

Definition of done
- active rows support `Unsubscribe`
- inactive rows are not displayed in UI list
- row actions are row-local pending-safe and do not block create flow
- action success invalidates subscriptions + My Feed queries

Evaluation
- manual smoke: unsubscribe removes row from visible list
- manual smoke: re-subscribing same channel restores active row without duplication
- regression smoke: `/my-feed` content-first behavior unchanged

Completion evidence (2026-02-17)
- Updated `src/pages/Subscriptions.tsx` to show active subscriptions only with `Unsubscribe` as the sole row action.
- Removed sync/reactivate controls and inactive-section UI from `/subscriptions`.
- Kept backend contracts unchanged (`DELETE` remains soft deactivate; re-subscribe reactivates existing rows).

### Step 13 - Ingestion reliability visibility
Scope
- surface ingestion trust status in `/subscriptions` without expanding user controls
- add a service-auth API to fetch latest ingestion job status for operator checks
- keep subscription UX simple (`Subscribe` / `Unsubscribe`)

Definition of done
- `/subscriptions` shows per-subscription health state (`healthy`, `delayed`, `error`, `waiting`)
- `/subscriptions` shows aggregate health summary and delayed warning indicator
- backend exposes `GET /api/ingestion/jobs/latest` with service-token auth
- runbook includes latest-job check and stale-poll triage guidance

Evaluation
- unit test: health mapping boundaries (59/60/61 minute threshold) pass
- manual smoke: health badges and summary visible with real subscription rows
- service smoke: latest ingestion job endpoint returns deterministic payload
- docs freshness and link checks pass

Completion evidence (2026-02-17)
- Added `src/lib/subscriptionHealth.ts` and `src/test/subscriptionHealth.test.ts`.

### Step 18 - Async auto-banner queue + global cap fallback policy
Scope
- add non-blocking auto-banner generation for subscription auto-ingest
- preserve generated banner URL separately from effective banner URL
- enforce global generated-banner cap with deterministic channel-default fallback

Definition of done
- subscription auto-ingest stays fast while banner jobs run in background (`SUBSCRIPTION_AUTO_BANNER_MODE=async`)
- worker endpoint processes queue with retries and dead-letter terminal state
- rebalance policy keeps newest generated banners up to cap and demotes older generated banners
- default fallback is deterministic per blueprint/channel

Evaluation
- unit tests for deterministic fallback + cap partition + retry transition
- manual smoke: auto-ingested item appears first, banner arrives later after worker trigger
- docs checks and build checks pass
- Updated `src/pages/Subscriptions.tsx` with health badges, summary counts, and delayed warning.
- Added `GET /api/ingestion/jobs/latest` (service-auth) to `server/index.ts`.

### Step 14 - YouTube Search-to-Blueprint (minimal, nav-visible)
Scope
- add auth-only `/search` discovery route and nav entry
- show transient YouTube search suggestions with no auto-save side effects
- allow one-click `Generate Blueprint` and `Subscribe Channel` from result cards

Definition of done
- `/search` is visible in main nav for signed-in users
- backend provides `GET /api/youtube-search` with deterministic error envelope
- clicking `Generate Blueprint` on a result saves to My Feed and routes user to `/my-feed`
- clicking `Subscribe Channel` is idempotent and reuses existing subscription APIs
- `/youtube` direct URL flow remains unchanged

Evaluation
- unit tests pass for search query validation, limit clamping, and response normalization
- manual smoke: search returns cards and actions work (`Generate Blueprint`, `Subscribe Channel`, `Open on YouTube`)
- regression smoke: `/youtube` URL workflow still works
- docs freshness and link checks pass

Completion evidence (2026-02-17)
- Added `server/services/youtubeSearch.ts` and wired `GET /api/youtube-search` in `server/index.ts`.
- Added frontend API client `src/lib/youtubeSearchApi.ts` and tests in `src/test/youtubeSearchApi.test.ts`.
- Added Search UI route/page (`src/pages/Search.tsx`) and nav item in `src/components/shared/AppNavigation.tsx`.
- Documented `YOUTUBE_DATA_API_KEY` requirement and additive endpoint contract updates.

### Step 15 - Subscription channel search (minimal, subscribe-first)
Scope
- add auth-only YouTube channel search endpoint for subscriptions discovery
- make `/subscriptions` search-first with per-result `Subscribe` action
- preserve `Unsubscribe` + ingestion health flows while moving subscribe into popup-only UX

Definition of done
- backend exposes `GET /api/youtube-channel-search` with deterministic envelope/errors
- `/subscriptions` supports channel query and renders transient result cards
- users can subscribe from a channel result idempotently
- existing unsubscribe and ingestion health surfaces remain intact

Evaluation
- unit tests pass for channel-search query validation, limit clamping, and normalization
- manual smoke: search channels -> subscribe from result -> active subscription list updates
- regression smoke: popup flow and unsubscribe continue to work
- docs freshness and link checks pass

Completion evidence (2026-02-17)
- Added `server/services/youtubeChannelSearch.ts` and wired `GET /api/youtube-channel-search` in `server/index.ts`.
- Added frontend client `src/lib/youtubeChannelSearchApi.ts` and tests in `src/test/youtubeChannelSearchApi.test.ts`.
- Updated `src/pages/Subscriptions.tsx` to support popup-based `Add Subscription` search UX without manual fallback input.

### Step 16 - Subscription row polish (avatar enrichment + hide technical row badges)
Scope
- enrich subscription rows with channel avatar URLs from YouTube API at read time
- simplify row UI by removing technical badges (`Active`, `Healthy`, `auto`) from each subscription row

Definition of done
- `GET /api/source-subscriptions` includes optional `source_channel_avatar_url` per row
- `/subscriptions` row UI shows avatar (or initials fallback) beside channel title
- row badges for active/health/mode are hidden while unsubscribe and health details remain

Evaluation
- manual smoke: subscription rows render avatars when available and fallback initials when missing
- manual smoke: row badges are no longer visible
- regression smoke: unsubscribe still works and ingestion health card remains unchanged
- docs freshness and link checks pass

Completion evidence (2026-02-17)
- Updated `server/index.ts` to enrich `GET /api/source-subscriptions` with YouTube avatar metadata (no schema changes).
- Updated `src/lib/subscriptionsApi.ts` type contract with optional `source_channel_avatar_url`.
- Updated `src/pages/Subscriptions.tsx` row rendering to show avatars and hide technical badges.

### Step 17 - Feed UX polish (My Feed + defaults)
Scope
- remove aggregate ingestion-health summary box from `/subscriptions`
- move My Feed submission actions into a compact `+` popup flow
- align My Feed blueprint cards with channel-feed style (banner + summary + tags)
- enable review/banner by default for manual/search generation paths
- enable review-by-default for subscription auto-ingest generation (banner remains off)

Definition of done
- `/subscriptions` no longer shows aggregate health summary counts
- My Feed blueprint cards show `+` and open submit dialog for channel submission actions
- My Feed still shows `Not submitted yet` when candidate does not exist
- Search -> Generate opens `/youtube` with review/banner on by default
- auto-ingested subscription items include review text more consistently

Evaluation
- manual smoke: subscriptions page no longer shows ingestion summary card
- manual smoke: My Feed `+` opens submit dialog and submit flow works
- manual smoke: Not submitted status remains visible until candidate exists
- regression smoke: publish/reject actions still work from dialog
- docs freshness and link checks pass

Completion evidence (2026-02-17)
- Updated `src/pages/Subscriptions.tsx` to remove aggregate ingestion health card.
- Updated `src/pages/MyFeed.tsx` to use channel-feed-style cards and `+` submission popup dialog.
- Updated `src/pages/Search.tsx` and `src/pages/YouTubeToBlueprint.tsx` for review/banner-on defaults in manual/search paths.
- Updated `server/index.ts` subscription auto-ingest pipeline to run review generation by default (banner still off).

### Step 18 - My Feed notice/card UX cleanup (single-box + post-label + unsubscribe confirm)
Scope
- remove nested "box inside box" look from `My Feed` blueprint cards while preserving channel-feed-style visuals
- label compact submit action as `Post to Channel`
- enrich subscription notice cards with channel avatar + optional profile-banner background
- replace notice-card link action with confirm-gated `Unsubscribe`
- on unsubscribe, remove the user-scoped `subscription_notice` card from `My Feed`

Definition of done
- My Feed blueprint cards render as a single visual container (no nested bordered shell)
- submit control clearly communicates intent with `Post to Channel`
- subscription notice cards show channel avatar (and banner when available)
- notice-card `Unsubscribe` requires confirmation
- successful unsubscribe removes that notice card from My Feed

Evaluation
- manual smoke: blueprint rows in My Feed no longer appear double-nested
- manual smoke: `Post to Channel` opens existing submit popup flow
- manual smoke: subscription notice shows avatar and optional background image
- manual smoke: unsubscribe confirm works and notice disappears after success
- regression smoke: candidate submit/publish/reject flow still works
- docs freshness and link checks pass

Completion evidence (2026-02-17)
- Updated `src/pages/MyFeed.tsx` for single-box blueprint card layout, labeled submit action, and notice-card unsubscribe confirmation.
- Updated `src/hooks/useMyFeed.ts` to load notice metadata (`source_channel_id`, `thumbnail_url`, `metadata.channel_banner_url`).
- Updated `src/lib/subscriptionsApi.ts` with channel-id-based unsubscribe helper for My Feed notice cards.
- Updated `server/index.ts` subscription notice insert to persist avatar/banner metadata and delete notice feed row on unsubscribe.

### Step 19 - My Feed interaction cleanup (copy + quick add + card-open)
Scope
- replace "pulled-content" header wording with simpler user-facing language
- add direct `Add Subscription` shortcut beside `Manage subscriptions` in My Feed
- remove plus icon glyph from `Post to Channel` control
- make subscription notice background fill entire card and shrink unsubscribe button footprint
- remove `Open blueprint` link and open blueprint details by clicking the blueprint card

Definition of done
- My Feed header uses non-technical copy and shows both subscription entrypoints
- `/subscriptions?add=1` opens add-subscription dialog directly
- `Post to Channel` button text remains but no icon is shown
- notice-card background fills full card surface
- blueprint cards navigate to detail on card click while action controls remain clickable

Evaluation
- manual smoke: header copy updated and both subscription buttons visible
- manual smoke: `Add Subscription` from My Feed opens subscriptions popup
- manual smoke: notice card background fills full card; unsubscribe appears compact
- manual smoke: clicking blueprint card opens detail; `Post to Channel` still opens submit popup
- docs freshness and link checks pass

Completion evidence (2026-02-17)
- Updated `src/pages/MyFeed.tsx` for copy, CTA layout, card click navigation, and notice-card visual/action refinements.
- Updated `src/pages/Subscriptions.tsx` to auto-open add dialog when `add=1` query param is provided.

### Step 20 - My Feed status-row interaction model (subscription details popup + footer post action)
Scope
- remove inline subscription-card `Unsubscribe` button from My Feed cards
- show relative `x time ago` in subscription card top-right and show `Subscription` badge in status row
- make subscription cards clickable to open a detailed popup with channel info and `Unsubscribe` action
- remove blueprint top-right `Post to Channel` button and move posting entrypoint to footer text action
- replace `Not submitted yet` with clickable `Post to Channel`; keep candidate status text after submission
- apply badge-style treatment for `In My Feed` in footer status slot

Definition of done
- subscription cards no longer show inline unsubscribe controls
- subscription cards show top-right relative time and bottom-right `Subscription` badge
- clicking a subscription card opens a detailed popup; unsubscribe remains confirm-gated
- blueprint cards no longer have top-right post button
- footer left action is clickable `Post to Channel` when no candidate and updates to candidate status after submit
- footer right `In My Feed` displays as badge-style status

Evaluation
- manual smoke: subscription card opens details popup and unsubscribe still works with confirm
- manual smoke: blueprint card top-right action removed, footer post action opens submit dialog
- manual smoke: footer status updates from `Post to Channel` to `Candidate: ...` after submission
- manual smoke: `In My Feed` renders as badge in footer right slot
- docs freshness and link checks pass

Completion evidence (2026-02-17)
- Updated `src/pages/MyFeed.tsx` with subscription-card details popup, footer-driven posting action, and status-row badge treatment.

### Step 21 - `/youtube` core-first async attach + timeout control hardening
Scope
- keep core generation path fast and predictable by forcing review/banner off in `/api/youtube-to-blueprint` request payload from `/youtube`
- run optional review/banner as async post-steps and attach results to saved blueprint when available
- allow `Save to My Feed` while optional post-steps are still running
- add env-controlled core timeout budget for backend endpoint

Definition of done
- `/youtube` core generation no longer blocks on optional review/banner operations
- users can save immediately after core generation and still receive late review/banner attachments
- backend endpoint timeout is controlled by `YT2BP_CORE_TIMEOUT_MS` with safe server bounds
- docs contracts are aligned with runtime behavior (frontend + backend + runbook)

Evaluation
- manual smoke: generate with review/banner toggles on, save before post-steps finish, then verify review/banner attach on saved blueprint
- manual smoke: timeout behavior remains stable under slow requests with configured timeout budget
- `npm run build`
- `npm run docs:refresh-check -- --json`
- `npm run docs:link-check`

Completion evidence (2026-02-18)
- Updated `src/pages/YouTubeToBlueprint.tsx` to force core payload review/banner off, run async post-steps, and allow non-blocking save.
- Updated `src/pages/YouTubeToBlueprint.tsx` to persist late review/banner results onto already-saved blueprints.
- Updated `server/index.ts` to use env-controlled `YT2BP_CORE_TIMEOUT_MS` (bounded `30000..300000`, default `120000`).
- Updated `server/llm/openaiClient.ts` banner prompt rules to enforce visual-only output (no readable text/typography/logos/watermarks).

### Step 22 - Subscription manual refresh popup + async selected generation
Scope
- add a `/subscriptions` `Refresh` action that opens a scan popup
- scan active subscriptions for new videos without immediately generating blueprints
- allow users to select scanned videos and start async generation in background

Definition of done
- `/subscriptions` shows a `Refresh` button that opens a popup flow
- scan returns selectable candidate videos per user
- clicking `Generate blueprints` closes popup and starts non-blocking async generation
- generation writes to My Feed as jobs complete and does not freeze the page

Evaluation
- manual smoke: open refresh popup -> scan -> list appears
- manual smoke: select videos -> generate -> popup closes quickly with background-start toast
- manual smoke: generated blueprints appear later in My Feed
- `npm run build`
- `npm run docs:refresh-check -- --json`
- `npm run docs:link-check`

Completion evidence (2026-02-18)
- Updated `src/pages/Subscriptions.tsx` with refresh popup UX, candidate selection, and async generate trigger.
- Added `POST /api/source-subscriptions/refresh-scan` in `server/index.ts`.
- Added `POST /api/source-subscriptions/refresh-generate` in `server/index.ts` with detached background job processing.

### Step 23 - Refresh/poll gotcha hardening
Scope
- add reliability guardrails for manual refresh and auto ingestion overlap
- hide repeatedly failing videos temporarily to reduce scan noise
- expose lightweight manual refresh background-job status in `/subscriptions`

Definition of done
- refresh endpoints enforce per-user cooldown caps (`scan=30s`, `generate=120s`)
- manual refresh generation enforces max 20 selected videos and one active job per user
- failed manual-refresh videos are suppressed from scan for 6 hours
- `/subscriptions` shows active refresh job status card with inserted/skipped/failed counts
- stale `running` ingestion and auto-banner jobs are auto-recovered by backend

Evaluation
- manual smoke: rapid scan/generate clicks produce deterministic rate-limit/lock behavior
- manual smoke: failed refresh video is hidden from next scan and reappears after cooldown
- manual smoke: status card transitions `Queued -> Running -> Succeeded|Failed`
- `npm run test`
- `npm run build`
- `npm run docs:refresh-check -- --json`
- `npm run docs:link-check`

Completion evidence (2026-02-18)
- Updated `server/index.ts` with route-specific refresh rate limiters, manual job lock, stale job recovery, and cooldown-backed scan filtering.
- Added owner-scoped endpoint `GET /api/ingestion/jobs/:id`.
- Added migration `supabase/migrations/20260219001500_refresh_video_attempts_v1.sql`.
- Updated `src/lib/subscriptionsApi.ts` with `getIngestionJob` and richer API error payload handling.
- Updated `src/pages/Subscriptions.tsx` with live background-generation status card + error mapping.

### Step 24 - Refresh checkpoint + reload-resume hardening
Scope
- prevent manual-generated videos from reappearing in subsequent auto polls
- restore active manual refresh status card after `/subscriptions` reload
- surface cooldown-filtered count in refresh dialog

Definition of done
- successful manual refresh generation advances per-subscription checkpoint forward
- `/subscriptions` can recover in-progress manual refresh jobs after reload
- scan dialog shows how many candidates are hidden by failure cooldown

Evaluation
- manual smoke: generate selected videos, then run auto/manual scan and verify those videos are not re-listed
- manual smoke: start refresh generate, reload `/subscriptions`, verify status card resumes
- manual smoke: failed video suppression count appears in scan dialog
- `npm run test`
- `npm run build`
- `npm run docs:refresh-check -- --json`
- `npm run docs:link-check`

Completion evidence (2026-02-18)
- Updated `server/index.ts` to advance `last_seen_*` checkpoint on successful manual refresh generation.
- Added owner-scoped endpoint `GET /api/ingestion/jobs/latest-mine` for refresh-status restore on reload.
- Updated `src/lib/subscriptionsApi.ts` with `getLatestMyIngestionJob`.
- Updated `src/pages/Subscriptions.tsx` to hydrate running job status and show `cooldown_filtered` scan count.

### Step 25 - Auto-channel pipeline cutover (general-first deterministic publish)
Scope
- shift channel publishing from manual My Feed action to deterministic auto-channel pipeline
- run auto-channel publish for all source paths (subscription auto-ingest, manual refresh generate, pending accept, URL/search save path)
- remove manual `Post to Channel` controls from default My Feed UI while retaining legacy endpoints behind a rollback flag

Definition of done
- backend orchestrator auto-assigns channel (`general`) and runs deterministic gates
- pass outcomes publish directly to channel feed and set My Feed state `channel_published`
- non-pass outcomes stay in My Feed with `channel_rejected` + reason code
- user endpoint `POST /api/my-feed/items/:id/auto-publish` is available for saved URL/search items
- My Feed shows read-only status labels instead of manual submit controls when auto pipeline feature flag is enabled

Evaluation
- manual smoke: URL save path auto-publishes and shows `Posted to ...` in My Feed
- manual smoke: search generate/save follows same auto-publish behavior
- manual smoke: subscription auto-ingest and manual refresh auto-publish without user channel action
- manual smoke: failed gate outcome stays visible in My Feed and is absent from Wall
- `npm run test`
- `npm run build`
- `npm run docs:refresh-check -- --json`
- `npm run docs:link-check`

Completion evidence (2026-02-18)
- Added `server/services/autoChannelPipeline.ts` deterministic orchestrator and gate-evaluation bridge.
- Updated `server/gates/index.ts` to allow mode override for auto-channel enforcement.
- Updated `server/index.ts` with auto-channel env controls, source-path integrations, `POST /api/my-feed/items/:id/auto-publish`, and legacy-manual rollback gate.
- Updated `src/pages/YouTubeToBlueprint.tsx` to trigger auto-publish after save.
- Updated `src/pages/MyFeed.tsx` to default to read-only auto-channel statuses in UI.

### Step 26 - Deterministic real-channel classification (tag+alias mapper)
Scope
- replace `general` placeholder routing with deterministic tag+alias channel resolution for new auto-published items
- keep safe fallback to `general` for ambiguous/no-match cases
- align channel-fit gate logic and Wall channel labels with the same source of truth

Definition of done
- backend classifier service resolves channel slug via exact tag match then alias match, with deterministic tie-break
- auto-channel pipeline returns additive classifier metadata (`classifier_mode`, `classifier_reason`)
- channel-fit gate uses deterministic resolver output for pass/warn decisions
- Wall channel label prefers latest published candidate channel and falls back to tag mapping
- My Feed held/rejected auto-mode cards show `In My Feed` without technical reason copy

Evaluation
- manual smoke: clear mapped tags route to non-`general` channel automatically
- manual smoke: ambiguous tags fall back to `general`
- manual smoke: Wall label follows published candidate channel when present
- `npm run test`
- `npm run build`
- `npm run docs:refresh-check -- --json`
- `npm run docs:link-check`

Completion evidence (2026-02-18)
- Added `server/services/deterministicChannelClassifier.ts` and tests for exact/alias/fallback/tie-break behavior.
- Updated `server/services/autoChannelPipeline.ts` to use classifier mode + fallback controls.
- Updated `server/gates/builtins.ts` channel-fit gate to use the same deterministic resolver.
- Updated `server/index.ts` with `AUTO_CHANNEL_CLASSIFIER_MODE`, `AUTO_CHANNEL_FALLBACK_SLUG`, and additive auto-publish metadata.
- Updated `src/pages/Wall.tsx` to prefer published candidate channel labels and `src/pages/MyFeed.tsx` to hide held-state technical reason text in auto mode.

### Step 27 - Two-step LLM channel labeler (post-artifact sync, retry+fallback)
Scope
- keep generation/artifact creation unchanged, then run sync channel-label pass before auto publish decision
- add `llm_labeler_v1` classifier mode using artifact-only context and allowed channel list
- trust valid label output, retry once on invalid output, and fallback to `general` if still invalid

Definition of done
- backend LLM interface includes `generateChannelLabel(...)` with strict JSON parsing
- auto-channel resolver supports `llm_labeler_v1` and returns additive classifier metadata including optional confidence
- channel-fit gate passes by design in `llm_labeler_v1` mode (`FIT_LLM_LABEL_PASS`), while quality/safety/pii remain unchanged
- `/api/my-feed/items/:id/auto-publish` response includes `classifier_mode`, `classifier_reason`, and optional `classifier_confidence`

Evaluation
- unit test: first valid label accepted (`llm_valid`)
- unit test: invalid then valid on retry (`llm_retry_valid`)
- unit test: invalid twice falls back to `general` (`fallback_general`)
- `npm run test`
- `npm run build`
- `npm run docs:refresh-check -- --json`
- `npm run docs:link-check`

Completion evidence (2026-02-18)
- Added `server/services/channelLabeler.ts` with whitelist validation, one retry, and fallback handling.
- Extended `server/llm/*` client contract with `generateChannelLabel` (OpenAI + mock).
- Updated `server/services/autoChannelPipeline.ts` and `server/gates/builtins.ts` for `llm_labeler_v1` classifier-aware routing.
- Updated `server/index.ts` and `src/lib/myFeedApi.ts` to include additive classifier confidence metadata in auto-publish responses.
- Added backend tests in `src/test/channelLabelerBackend.test.ts` and expanded channel-fit backend tests for llm mode.

### Step 28 - Attribution + subscription-surface cleanup
Scope
- blueprint detail header should display source-channel attribution for imported YouTube blueprints
- remove default MVP edit CTA from blueprint detail
- simplify subscription notice details and subscriptions list copy density

Definition of done
- `BlueprintDetail` header shows source channel name (fallback to creator only when source metadata is unavailable)
- subscription notice popup no longer shows absolute timestamp or open-channel action
- subscriptions rows hide raw URL and verbose poll text; avatar opens channel

Evaluation
- manual smoke: blueprint detail shows source channel instead of creator on imported YouTube blueprint
- manual smoke: My Feed subscription popup shows relative added time and unsubscribe only
- manual smoke: subscriptions rows are simplified and avatar opens channel
- `npm run build`
- `npm run docs:refresh-check -- --json`
- `npm run docs:link-check`

### Step 29 - Home naming + profile-oriented nav
Scope
- rename signed-in shared lane label from `Channel Feed` to `Home` while keeping route `/wall`
- remove `My Feed` from top/floating nav
- align core surface copy and canonical docs to Home terminology

Definition of done
- signed-in nav shows `Home / Search / Channels / Explore`
- core feed surfaces and docs call `/wall` the Home feed

Evaluation
- manual smoke: signed-in header and floating nav labels/order are correct
- manual smoke: `/wall` and channel-page CTA copy reference Home
- `npm run build`
- `npm run docs:refresh-check -- --json`
- `npm run docs:link-check`

### Step 30 - Profile workspace tabs (`Feed / Comments / Liked`) + dropdown cleanup
Scope
- make profile the main personal workspace: tabs are now `Feed / Comments / Liked`
- remove legacy `Blueprints / Libraries / Activity` profile tabs
- remove `My Feed` from user dropdown and keep `/my-feed` as compatibility/direct route

Definition of done
- profile tabs show `Feed / Comments / Liked`
- feed tab reuses My Feed timeline visuals; non-owner viewers can view public profiles but cannot mutate
- comments tab is sourced from `blueprint_comments` history with blueprint links
- user menu no longer contains `My Feed`

Evaluation
- manual smoke: owner profile has full feed actions
- manual smoke: non-owner public profile feed hides owner-only actions
- manual smoke: comments tab renders snippets + blueprint links + relative time
- `npm run build`
- `npm run docs:refresh-check -- --json`
- `npm run docs:link-check`

## Iteration Template (Use Each Cycle)
1. Proposed update summary
2. Plan with touched files and acceptance checks
3. `PA` approval record
4. Implementation summary
5. Validation evidence
6. Follow-up options

## Notes
- Future sources (PDF, audio/podcast, others) should fit the same adapter abstraction.
- Future gates should be plug-in additions to the gate pipeline, not bespoke branches.
