# Architecture (`bleuV1`)

## 1) Intent And Boundaries
- Direction lock reference:
  - `docs/app/core-direction-lock.md`
- Product scope:
  - Source-first blueprint app.
  - Personal unfiltered feed (`My Feed`) as primary lane.
  - Home feed (`/wall`) as shared lane with classifier-driven auto-channel publishing.
- Current adapter baseline:
  - YouTube adapter is production-ready for direct URL generation and subscription ingestion.
- Non-goals in current MVP:
  - No broad multi-adapter rollout in the first cut.
  - No fully open standalone free-form posting model.
  - No full moderation platform for user-created channels.

## 2) Runtime Topology
- Frontend:
  - React + Vite app (`src/pages/*`).
  - Landing page (`/`) is value-first for cold users:
    - logged-out primary CTA is `Try YouTube URL` (`/youtube`)
    - above-the-fold proof card shows live blueprint output when available, otherwise curated example fallback
    - use-case strip communicates concrete outcomes (fitness/recipes/study/productivity)
    - social-proof sections keep curated fallback content when live data is empty
  - Signed-in primary nav uses `Home / Channels / Explore`.
  - Header `Create` action (next to profile menu) routes to `/search` for search/create discovery.
  - New-account onboarding is optional and route-based:
    - first-login redirect for new accounts goes to `/welcome`
    - existing pre-rollout accounts are not auto-prompted
    - users can skip setup and continue to Home
  - Core copy across high-traffic surfaces is intentionally aligned to runtime terms (`Home`, `Create`, auto-channel publish) to avoid legacy flow drift.
  - Frontend bootstrap has required-env guard:
    - missing `VITE_SUPABASE_URL` or `VITE_SUPABASE_PUBLISHABLE_KEY` renders a configuration screen instead of a blank page.
  - Personal workspace is profile-first at `/u/:userId` with tabs `Feed / Comments / Liked / Subscriptions` (subscriptions tab owner-only); `/my-feed` remains direct-access compatible.
  - Profile visibility default is public for new accounts (`profiles.is_public=true` by default).
  - Live adapter UI in `src/pages/YouTubeToBlueprint.tsx`.
    - `/youtube` runs a core-first request (`generate_review=false`, `generate_banner=false`) and executes optional review/banner as async post-steps.
    - `Save to My Feed` is intentionally non-blocking while optional post-steps finish; completed review/banner updates are attached to the saved blueprint later.
    - banner prompt path is constrained to visual-only output (no readable text/typography/logos/watermarks).
  - Auth-only discovery UI in `src/pages/Search.tsx` for YouTube query results and one-click generate.
  - Live feed/community surfaces in `src/pages/MyFeed.tsx`, `src/pages/Wall.tsx`, `src/pages/Channels.tsx`, `src/pages/ChannelPage.tsx`.
    - `My Feed` blueprint rows use channel-feed-like visual cards, open detail on card click, and use footer status labels (`Posted to <Channel>`, `Publishing...`, or `In My Feed`) with a unified `Blueprint` badge.
    - `My Feed` subscription notices render avatar and optional banner background; card click opens a details popup with confirm-gated `Unsubscribe`.
    - subscription notice details popup is intentionally minimal (relative time + unsubscribe only).
    - `My Feed` header includes both `Add Subscription` and `Manage subscriptions` entrypoints.
  - Blueprint detail in `src/pages/BlueprintDetail.tsx` now prefers source-channel attribution for imported YouTube blueprints and hides edit CTA in default MVP UI.
  - Subscription management surface in `src/pages/Subscriptions.tsx` (MVP-simplified: popup channel search + subscribe + active-list `Unsubscribe`; aggregate health summary hidden for user clarity; row avatars shown when available).
    - active subscription rows are copy-light; avatar is the channel-open link target.
    - includes YouTube OAuth connect + bulk import flow (`Connect YouTube` -> preview -> select channels -> import).
    - import selection defaults to none selected; users explicitly choose channels to import.
    - disconnect revokes+unlinks OAuth tokens but keeps existing app subscriptions unchanged.
    - includes manual `Refresh` popup flow: scan new subscription videos, select items, and start async background generation.
  - Onboarding setup surface in `src/pages/WelcomeOnboarding.tsx`:
    - reuses OAuth connect/import APIs
    - marks completion only after successful import (`imported` or `reactivated` > 0)
    - skip path records non-blocking onboarding state.
  - User menu includes a direct `Subscriptions` shortcut to `/subscriptions`; profile tab keeps a lightweight owner-only list with `Unsubscribe`.
- Backend:
  - Express server in `server/index.ts`.
  - `/api/youtube-to-blueprint` generation pipeline.
  - subscription ingestion APIs:
    - `POST|GET|PATCH|DELETE /api/source-subscriptions`
      - `GET` enriches rows with optional `source_channel_avatar_url` from YouTube API (no DB write path required)
      - `POST` notice insertion stores channel avatar + optional banner metadata for My Feed notice-card rendering
      - `DELETE` deactivates subscription and removes user-scoped `subscription_notice` feed row for that channel
    - `POST /api/source-subscriptions/:id/sync`
    - `POST /api/source-subscriptions/refresh-scan` (auth-only scan, returns candidate videos; no blueprint generation side effects)
    - `POST /api/source-subscriptions/refresh-generate` (auth-only enqueue for selected videos; starts async background generation job)
    - `GET /api/ingestion/jobs/:id` (auth-only, owner-scoped status for manual refresh background jobs)
    - `GET /api/ingestion/jobs/latest-mine` (auth-only, user-scoped latest refresh job; used to restore in-flight status after reload)
    - `GET /api/youtube-search` (auth-only YouTube result discovery, relevance-sorted)
    - `GET /api/youtube-channel-search` (auth-only YouTube channel discovery, relevance-sorted)
    - `GET /api/youtube/connection/status` (auth-only YouTube OAuth status)
    - `POST /api/youtube/connection/start` (auth-only OAuth start, returns auth URL)
    - `GET /api/youtube/connection/callback` (anonymous callback; state-validated and redirects back to app)
    - `GET /api/youtube/subscriptions/preview` (auth-only paginated import preview, all pages up to cap)
    - `POST /api/youtube/subscriptions/import` (auth-only bulk import with idempotent upsert + inactive reactivation)
    - `DELETE /api/youtube/connection` (auth-only revoke+unlink)
    - `POST /api/ingestion/jobs/trigger` (service auth)
    - `GET /api/ingestion/jobs/latest` (service auth, latest job snapshot)
    - `POST /api/auto-banner/jobs/trigger` (service auth, queue worker + cap rebalance)
    - `GET /api/auto-banner/jobs/latest` (service auth, queue snapshot)
    - `POST /api/debug/subscriptions/:id/simulate-new-uploads` (debug-only, service auth + `ENABLE_DEBUG_ENDPOINTS=true`; middleware allows service-token access without bearer user auth)
    - `POST /api/my-feed/items/:id/accept|skip`
    - `POST /api/my-feed/items/:id/auto-publish`
  - Adapter abstraction in `server/adapters/*` (`BaseAdapter`, `YouTubeAdapter`, registry).
  - Subscription resolver in `server/services/youtubeSubscriptions.ts` supports `browseId` fallback extraction for YouTube handle pages.
  - Candidate gate pipeline in `server/gates/*` (`Gate` contract + ordered all-gates-run execution).
  - Gate runtime mode switch: `CHANNEL_GATES_MODE = bypass | shadow | enforce` (default `bypass`).
- Data:
  - Supabase is system of record for blueprints, tags, follows, likes/comments, telemetry.
  - `bleuV1` extension: source-item canonical tables + user feed item tables + subscription/ingestion job tables + auto-banner policy/queue tables.
  - onboarding extension: `user_youtube_onboarding` for new-user optional setup state.
- Eval assets:
  - Runtime policy/config under `eval/methods/v0/*`.
- Operations:
  - Oracle VM runtime + logs-first runbook (`docs/ops/yt2bp_runbook.md`).

## 3) Core Lifecycle (`bleuV1`)
1. (Optional) New-account onboarding:
   - first authenticated session for new accounts is redirected once to `/welcome`.
   - onboarding remains optional (`Skip for now`) and never blocks normal usage after skip.
   - completion is import-success-only; connect-only does not complete onboarding.
2. Ingest source item (manual URL pull or subscription sync).
   - discovery option: user can search YouTube results in `/search` before selecting a source video.
   - Search-generated `/youtube` handoff carries channel context (id/title/url) so saved source items retain channel subtitle data in My Feed.
   - My Feed source subtitle mapping also falls back to source metadata channel title when column-level channel title is absent.
   - `/youtube` core request is timeout-bounded by `YT2BP_CORE_TIMEOUT_MS` (default `120000`).
   - optional review/banner generation is executed outside the core endpoint request and may attach after save.
3. Subscription create/reactivate:
   - user opens `/subscriptions`, launches `Add Subscription`, searches channels, then clicks subscribe.
   - optional onboarding accelerator: user connects YouTube on `/subscriptions` and imports selected subscriptions in bulk.
   - user can unsubscribe existing active rows from `/subscriptions`; sync/reactivate UI is deferred.
   - resolve channel id and set first-sync checkpoint only (`last_seen_published_at`, `last_seen_video_id`).
   - no historical prefill on first subscribe in MVP.
   - create one persistent notice card (`user_feed_items.state = subscription_notice`) with avatar + optional banner metadata.
   - unsubscribe removes that user-scoped notice card while preserving other My Feed blueprint items.
4. Subscription sync after checkpoint:
   - new uploads generate immediately to `my_feed_published`.
   - auto-ingest path enables review generation by default.
   - auto-banner mode is controlled by env:
     - `off`: no auto banner processing.
     - `async`: enqueue `auto_banner_jobs`, ingest stays non-blocking.
     - `sync`: generate inline (ops/debug mode; higher latency).
   - successful auto-banner jobs set `blueprints.banner_generated_url` and `blueprints.banner_url`.
   - cap rebalance enforces newest generated banners up to `SUBSCRIPTION_AUTO_BANNER_CAP`; older generated banners fall back to deterministic channel defaults or `null`.
   - subscription health state is derived in UI from `last_polled_at` + `last_sync_error` (`healthy`, `delayed`, `error`, `never_polled`).
   - manual refresh flow can scan candidate videos and enqueue selected generation in a detached background job (`ingestion_jobs.scope = manual_refresh_selection`), so UI stays responsive.
   - manual refresh hardening:
     - per-user route cooldowns on refresh endpoints (`scan=30s`, `generate=120s`)
     - selected-item cap for manual generation (`max=20`)
     - active-job lock (`JOB_ALREADY_RUNNING`) for manual generation
     - failed item cooldown (6h) via `refresh_video_attempts` so noisy failures do not reappear immediately.
     - successful manual generation advances subscription checkpoint forward to prevent future auto-poll duplicates.
     - frontend restores active manual refresh status after reload via `GET /api/ingestion/jobs/latest-mine`.
   - stale running ingestion jobs are recovered before new service/manual trigger paths execute (`STALE_RUNNING_RECOVERY`).
5. Optional user remix/insight.
6. Channel candidate evaluation (all-gates-run default, aggregated decision).
   - channel resolution mode is env-driven via `AUTO_CHANNEL_CLASSIFIER_MODE`:
     - `deterministic_v1`: tag+alias mapping with deterministic tie-break.
     - `llm_labeler_v1`: post-artifact sync label pass using title/review/tags/step hints against allowed channel list.
     - `general_placeholder`: rollback mode, routes everything to fallback slug.
   - `llm_labeler_v1` invalid output handling: retry once, then fallback slug (`AUTO_CHANNEL_FALLBACK_SLUG`, default `general`).
7. Gate decision:
   - pass -> publish to Home feed (`/wall`)
   - warn/block -> remain personal-only

Current production behavior note:
- Legacy manual candidate flow remains bypass-first by default (`CHANNEL_GATES_MODE=bypass`) for rollback compatibility.
- Auto-channel flow can enforce deterministic checks independently via `AUTO_CHANNEL_GATE_MODE`.
- Channel-fit behavior is classifier-aware:
  - deterministic modes: fit checks use deterministic mapper alignment.
  - `llm_labeler_v1`: fit gate returns pass-by-design (`FIT_LLM_LABEL_PASS`) for selected label.

## 4) Contracts And Policy Surfaces
- API contract (adapter v0):
  - `docs/product-specs/yt2bp_v0_contract.md`
- Product behavior:
  - `docs/app/product-spec.md`
- Program direction:
  - `docs/exec-plans/active/bleuv1-source-first-program.md`
- Eval policy classes used today:
  - `llm_blueprint_quality_v0`
  - `llm_content_safety_grading_v0`
  - `pii_leakage_v0`
- `bleuV1` gate expansion:
  - channel-fit gate for channel promotion decisions
- runtime gate mode:
  - `bypass`: force publish-eligible status, reason `EVAL_BYPASSED`
  - `shadow`: compute and persist real decisions, keep publish-eligible status
  - `enforce`: apply real pass/warn/block routing
- executable interface hardening:
  - unified API envelope for planned endpoints
  - user/service auth split for mutable operations
  - hybrid idempotency model (natural-key upserts + idempotency keys)
  - core endpoint timeout control: `YT2BP_CORE_TIMEOUT_MS` (default `120000`, bounded server-side)

## 5) Invariants
- Safety invariants:
  - Safety and PII checks can block shared-channel distribution.
- Provenance invariants:
  - Imported blueprints retain source provenance metadata.
- Distribution invariants:
  - Channel publish is never unconditional; automatic publishing is blocked on deterministic gate pass.
- Compatibility invariants:
  - Existing public blueprint feed and channel routes remain functional while `My Feed` is introduced.
  - Legacy library/inventory surfaces remain compatibility-only (non-core) until post-MVP cleanup.
  - Legacy no-blueprint pending/skipped rows are filtered out in `My Feed` rendering.
  - Legacy pending-card endpoints (`/api/my-feed/items/:id/accept|skip`) remain available for compatibility/operator flows.
  - Legacy manual candidate endpoints remain available behind `AUTO_CHANNEL_LEGACY_MANUAL_FLOW_ENABLED`.

## 6) Failure Modes And Recovery
- Frequent classes (adapter/generation):
  - `INVALID_URL`, `NO_CAPTIONS`, `PROVIDER_FAIL`, `TIMEOUT`, `RATE_LIMITED`,
    `GENERATION_FAIL`, `SAFETY_BLOCKED`, `PII_BLOCKED`.
- `bleuV1` distribution classes:
  - `CHANNEL_FIT_BLOCKED`, `QUALITY_BLOCKED`, `DUPLICATE_INGEST`.
  - `EVAL_BYPASSED` (expected in bypass mode).
  - `JOB_ALREADY_RUNNING`, `MAX_ITEMS_EXCEEDED`, `STALE_RUNNING_RECOVERY`.
- Recovery authority:
  - Logs-first triage in `docs/ops/yt2bp_runbook.md`.
  - Feature/env toggles for fast rollback.

## 7) Extension Model
- New adapters:
  - Add canonical adapter interface and preserve downstream lifecycle contract.
  - Gate rollout by reliability + cache hit + approval metrics.
- New eval classes:
  - Add method pack under `eval/methods/v0/<method_id>/`.
  - Wire into channel candidate stage only after smoke checks.
- Community layer expansion:
  - Keep user insights/remixes attached to imported blueprints in MVP.

## 8) Document Ownership
- Canonical architecture doc: `docs/architecture.md`.
- Product contract: `docs/app/product-spec.md`.
- Active program plan: `docs/exec-plans/active/bleuv1-source-first-program.md`.
- Freshness mapping: `docs/_freshness_map.json`.
