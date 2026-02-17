# Architecture (`bleuV1`)

## 1) Intent And Boundaries
- Product scope:
  - Source-first blueprint app.
  - Personal unfiltered feed (`My Feed`) as primary lane.
  - Channel feeds as shared lanes with gated promotion.
- Current adapter baseline:
  - YouTube adapter is production-ready for direct URL generation and subscription ingestion.
- Non-goals in current MVP:
  - No broad multi-adapter rollout in the first cut.
  - No fully open standalone free-form posting model.
  - No full moderation platform for user-created channels.

## 2) Runtime Topology
- Frontend:
  - React + Vite app (`src/pages/*`).
  - Live adapter UI in `src/pages/YouTubeToBlueprint.tsx`.
  - Auth-only discovery UI in `src/pages/Search.tsx` for YouTube query results and one-click generate.
  - Live feed/community surfaces in `src/pages/MyFeed.tsx`, `src/pages/Wall.tsx`, `src/pages/Channels.tsx`, `src/pages/ChannelPage.tsx`.
  - Subscription management surface in `src/pages/Subscriptions.tsx` (MVP-simplified: channel search + subscribe + active-list `Unsubscribe` + ingestion health signals).
- Backend:
  - Express server in `server/index.ts`.
  - `/api/youtube-to-blueprint` generation pipeline.
  - subscription ingestion APIs:
    - `POST|GET|PATCH|DELETE /api/source-subscriptions`
    - `POST /api/source-subscriptions/:id/sync`
    - `GET /api/youtube-search` (auth-only YouTube result discovery, relevance-sorted)
    - `GET /api/youtube-channel-search` (auth-only YouTube channel discovery, relevance-sorted)
    - `POST /api/ingestion/jobs/trigger` (service auth)
    - `GET /api/ingestion/jobs/latest` (service auth, latest job snapshot)
    - `POST /api/debug/subscriptions/:id/simulate-new-uploads` (debug-only, service auth + `ENABLE_DEBUG_ENDPOINTS=true`; middleware allows service-token access without bearer user auth)
    - `POST /api/my-feed/items/:id/accept|skip`
  - Adapter abstraction in `server/adapters/*` (`BaseAdapter`, `YouTubeAdapter`, registry).
  - Subscription resolver in `server/services/youtubeSubscriptions.ts` supports `browseId` fallback extraction for YouTube handle pages.
  - Candidate gate pipeline in `server/gates/*` (`Gate` contract + ordered all-gates-run execution).
  - Gate runtime mode switch: `CHANNEL_GATES_MODE = bypass | shadow | enforce` (default `bypass`).
- Data:
  - Supabase is system of record for blueprints, tags, follows, likes/comments, telemetry.
  - `bleuV1` extension: source-item canonical tables + user feed item tables + subscription/ingestion job tables.
- Eval assets:
  - Runtime policy/config under `eval/methods/v0/*`.
- Operations:
  - Oracle VM runtime + logs-first runbook (`docs/ops/yt2bp_runbook.md`).

## 3) Core Lifecycle (`bleuV1`)
1. Ingest source item (manual URL pull or subscription sync).
   - discovery option: user can search YouTube results in `/search` before selecting a source video.
2. Subscription create/reactivate:
   - user opens `/subscriptions` and searches channels, then clicks subscribe (manual URL/channel ID/@handle fallback remains).
   - user can unsubscribe existing active rows from `/subscriptions`; sync/reactivate UI is deferred.
   - resolve channel id and set first-sync checkpoint only (`last_seen_published_at`, `last_seen_video_id`).
   - no historical prefill on first subscribe in MVP.
   - create one persistent notice card (`user_feed_items.state = subscription_notice`).
3. Subscription sync after checkpoint:
   - new uploads generate immediately to `my_feed_published`.
   - subscription health state is derived in UI from `last_polled_at` + `last_sync_error` (`healthy`, `delayed`, `error`, `never_polled`).
4. Optional user remix/insight.
5. Channel candidate evaluation (all-gates-run default, aggregated decision).
6. Gate decision:
   - pass -> publish to channel feed
   - warn in selected mode (`channel_fit`/`quality`) -> `candidate_pending_manual_review`
   - fail/block -> remain personal-only

Current production behavior note:
- Gate contract exists, but evaluation outcome is currently bypassed in production mode (`EVAL_BYPASSED`) until hardening rollout completes.

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

## 5) Invariants
- Safety invariants:
  - Safety and PII checks can block shared-channel distribution.
- Provenance invariants:
  - Imported blueprints retain source provenance metadata.
- Distribution invariants:
  - Channel publish is never unconditional; it is a gated second-stage action.
- Compatibility invariants:
  - Existing public blueprint feed and channel routes remain functional while `My Feed` is introduced.
  - Legacy no-blueprint pending/skipped rows are filtered out in `My Feed` rendering.
  - Legacy pending-card endpoints (`/api/my-feed/items/:id/accept|skip`) remain available for compatibility/operator flows.
  - Gate runtime mode remains `CHANNEL_GATES_MODE=bypass` in production for this cycle.

## 6) Failure Modes And Recovery
- Frequent classes (adapter/generation):
  - `INVALID_URL`, `NO_CAPTIONS`, `PROVIDER_FAIL`, `TIMEOUT`, `RATE_LIMITED`,
    `GENERATION_FAIL`, `SAFETY_BLOCKED`, `PII_BLOCKED`.
- `bleuV1` distribution classes:
  - `CHANNEL_FIT_BLOCKED`, `QUALITY_BLOCKED`, `DUPLICATE_INGEST`.
  - `EVAL_BYPASSED` (expected in bypass mode).
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
