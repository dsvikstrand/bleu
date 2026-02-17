# Product Spec (`bleuV1` Direction)

## One-Line Product Promise
`bleuV1` is a source-first app that turns favorite media into bite-sized blueprints, enriched by community insights.

## Status Snapshot
a1) [have] YouTube to Blueprint generation is live (`/youtube` + `/api/youtube-to-blueprint`).
a2) [have] Public feed/channel/community primitives are live (`/wall`, `/channels`, `/b/:channelSlug`, likes/comments).
a3) [have] `My Feed` personal unfiltered lane is available as `/my-feed` (feature-flagged rollout).
a4) [have] Auto-ingestion from followed YouTube channels is available with auto-only UX and new-uploads-only behavior (no initial old-video prefill).
a5) [have] Channel publish is an explicit second-stage lifecycle from personal feed candidates.
a6) [have] Channel gate runtime is currently bypass-first (`EVAL_BYPASSED`) while gate-mode framework hardening is completed.
a7) [have] Legacy pending/skipped feed rows without blueprints are hidden in `My Feed` UI to reduce migration noise.
a8) [have] `/subscriptions` is simplified for MVP to two visible actions: `Add Subscription` (popup search) and per-row `Unsubscribe`.
a9) [have] `/subscriptions` hides the aggregate ingestion-health summary box to reduce new-user confusion.
a10) [have] Auth-only `Search` route (`/search`) now supports YouTube query discovery with one-click `Generate Blueprint` and `Subscribe Channel`.
a11) [have] `/subscriptions` now supports auth-only YouTube channel search with popup-based subscribe flow (manual paste fallback removed in UI).
a12) [have] Subscription rows now render channel avatar thumbnails (when available) and hide technical status/mode badges from row UI.
a13) [have] `My Feed` blueprint rows now use channel-feed-style visual cards and open channel submission from a compact `+` popup action.
a14) [have] Manual/search YouTube generation defaults to review+banner enabled for My Feed-bound content.

## Core Model
b1) `Source Item`
- Media object from an adapter (YouTube v1).
- Canonical identity key (example: `youtube_video_id`) for dedupe/cache.

b2) `Imported Blueprint` (primary content type)
- Generated step-by-step blueprint from a source item.
- Includes source provenance and generation metadata.

b3) `User Insight/Remix` (secondary content type)
- User-added value layered on an imported blueprint.
- Not a standalone free-form post type in `bleuV1` MVP.

b4) Feed surfaces
- `My Feed`: personal unfiltered lane from user pulls/subscriptions.
- `Channel Feed`: shared lane with voting/comments and quality-controlled channel posting.

b5) Subscription behavior (MVP simplified)
- UI behavior is auto-only.
- On subscribe, backend sets a checkpoint (`last_seen_published_at` / `last_seen_video_id`) without ingesting historical uploads.
- Future uploads after checkpoint ingest directly to `my_feed_published`.
- Auto-ingested subscription items run review generation by default; banner generation remains off in this path.
- A persistent notice card is inserted into `My Feed` with state `subscription_notice`.
- API compatibility note: `mode` is accepted on subscription endpoints but coerced/treated as `auto`.

## MVP Lifecycle Contract
c1) Pull/ingest -> generate blueprint -> publish to `My Feed`.
c2) Optional user remix/insight.
c3) Candidate to channel publish.
c4) Channel gate contract remains (`channel_fit`, `quality`, `safety`, `pii`) with production default mode currently `bypass`.
c5) Result:
- pass -> publish to channel feed
- fail -> remain in `My Feed` (personal-only)
c6) Warn-path result in selected mode:
- `channel_fit`/`quality` warn routes candidate to `candidate_pending_manual_review` before terminal publish/reject.
c7) Subscription notice flow:
- successful subscribe/reactivate inserts one persistent notice card per user/channel.
- notice canonical key: `subscription:youtube:<channel_id>`.
- notice cards are informational and have no Accept/Skip or channel submit controls.

## Product Principles
p1) Source-first content supply (not creator-first posting).
p2) Personal-first ownership (`My Feed` is always available).
p3) Community adds interpretation/opinion via insights/remixes.
p4) Channel cleanliness enforced by explicit gates.
p5) Explainable in one sentence.

## MVP Default Policies (Lock)
m1) Adapter scope default: YouTube-only.
m2) My Feed default visibility: personal/private lane until channel promotion.
m3) Channel promotion default mode: selected/manual approve path.
m4) User contribution default: insights/remixes attached to imported blueprints (no standalone free-form posting in MVP core).
m5) Low-confidence channel candidates default action: blocked from channel, retained in My Feed.
m6) Evaluator default mode: all-gates-run with aggregated decision evidence.
m7) Planned mutable interfaces use explicit auth scope + idempotency mode and unified response envelope.
m8) Runtime default `CHANNEL_GATES_MODE=bypass`; non-prod may run `shadow` or `enforce`.

## Primary User Flows (`bleuV1`)
f1) User follows YouTube channels from `/subscriptions` by clicking `Add Subscription`, searching channels, and clicking `Subscribe`.
f2) User can unsubscribe from active channels directly on `/subscriptions` (unsubscribed rows disappear from the page list).
f3) User can search YouTube from `/search` and get transient result suggestions (not persisted yet).
f4) User selects `Generate Blueprint` on a result to generate and save directly into `My Feed`.
f5) User can subscribe to a result’s channel from the same search card.
f6) On subscribe/reactivate, user gets one subscription notice card and future uploads ingest automatically into `My Feed`.
f7) From `My Feed`, user opens `+` to submit a blueprint to channels (candidate second-step flow).
f8) User scans, remixes, and adds insights.
f9) Eligible items are promoted to channel feeds after gates.
f10) Community votes/comments to surface higher-value items.

## Route and IA Snapshot
r1) [have] Home: `/`
r2) [have] Feed: `/wall`
r3) [have] Explore: `/explore`
r4) [have] Channels index: `/channels`
r5) [have] Channel page: `/b/:channelSlug`
r6) [have] YouTube adapter page (manual v0): `/youtube`
r7) [have] Blueprint detail: `/blueprint/:blueprintId`
r8) [have] My Feed first-class route: `/my-feed`
r9) [have] Subscriptions route: `/subscriptions`
r10) [have] Search route: `/search` (auth-only)
r11) [have] Compatibility redirects: `/tags` -> `/channels`, `/blueprints` -> `/wall`

## Scope Boundaries (MVP)
s1) In scope
- YouTube adapter as first and only required adapter.
- Personal feed from pulled media.
- Channel publish gating and moderation-lite rules.
- Community interactions on shared blueprints (likes/comments).

s2) Out of scope
- Multi-adapter rollout in same MVP cut.
- Sync/reactivate user controls in `/subscriptions` are deferred (future “sync specific videos” flow).
- Debug simulation UI exposure remains deferred (operator-only endpoint stays hidden from user UI).
- Fully open free-form blog/social posting model.
- Full moderation platform for user-generated channels.

## Data Surfaces (Current + Direction)
d1) [have] `blueprints`, `blueprint_tags`, `blueprint_likes`, `blueprint_comments`.
d2) [have] `tag_follows`, `tags`, `profiles`, `mvp_events`.
d3) [have] Source ingestion + feed tables (`source_items`, `user_source_subscriptions`, `user_feed_items`).
d4) [have] Channel candidate + decision logs (`channel_candidates`, `channel_gate_decisions`).
d5) [have] Scheduled/user-triggered ingestion jobs + trace table (`ingestion_jobs`).

## Subscription Interfaces (MVP)
si1) `POST /api/source-subscriptions` with `{ channel_input, mode? }` (`mode` accepted but ignored/coerced to `auto` in MVP path)
si2) `GET /api/source-subscriptions`
si3) `PATCH /api/source-subscriptions/:id` with `{ mode?, is_active? }` (`mode` accepted for compatibility and coerced to `auto`)
si4) `DELETE /api/source-subscriptions/:id` (soft deactivate)
si5) `POST /api/source-subscriptions/:id/sync` (user sync)
si6) `POST /api/ingestion/jobs/trigger` (service auth for cron)
si7) `POST /api/my-feed/items/:id/accept`
si8) `POST /api/my-feed/items/:id/skip`
si9) debug-only endpoint (service auth + env gate): `POST /api/debug/subscriptions/:id/simulate-new-uploads` (`ENABLE_DEBUG_ENDPOINTS=true` required, authenticated by `x-service-token`, no user bearer token required)
si10) YouTube channel resolver accepts handle/channel URL/channel ID and uses `browseId` fallback parsing for handle pages where `channelId` is absent.
si11) service-ops endpoint: `GET /api/ingestion/jobs/latest` (service auth; latest ingestion health snapshot)
si12) YouTube search endpoint: `GET /api/youtube-search?q=<query>&limit=<1..25>&page_token=<optional>`
si13) YouTube channel search endpoint: `GET /api/youtube-channel-search?q=<query>&limit=<1..25>&page_token=<optional>`
si14) `GET /api/source-subscriptions` now includes optional `source_channel_avatar_url` per subscription row (derived from YouTube API; no schema change).

## Next Milestone (Hardening)
n1) Keep production gate behavior stable with `CHANNEL_GATES_MODE=bypass`.
n2) Iterate YouTube search discovery flow before introducing multi-adapter search.
n3) Harden ingestion reliability visibility (polling freshness + latest job checks) before adding more subscription features.
n4) Reserve `enforce` mode for non-prod verification until dedicated rollout approval.

## Key References
k1) Architecture: `docs/architecture.md`
k2) Program + project status: `docs/exec-plans/index.md`
k3) Active direction plan: `docs/exec-plans/active/bleuv1-source-first-program.md`
k4) YT2BP contract: `docs/product-specs/yt2bp_v0_contract.md`
