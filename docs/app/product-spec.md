# Product Spec (`bleuV1` Direction)

## One-Line Product Promise
`bleuV1` is a source-first app that turns favorite media into bite-sized blueprints, enriched by community insights.

## Status Snapshot
a1) [have] YouTube to Blueprint generation is live (`/youtube` + `/api/youtube-to-blueprint`).
a2) [have] Public feed/channel/community primitives are live (`/wall`, `/channels`, `/b/:channelSlug`, likes/comments).
a3) [have] `My Feed` personal unfiltered lane is available as `/my-feed` (feature-flagged rollout).
a4) [todo] Auto-ingestion from followed source channels (YouTube first).
a5) [have] Channel publish is an explicit second-stage lifecycle from personal feed candidates.
a6) [have] Channel gate runtime is currently bypass-first (`EVAL_BYPASSED`) while gate-mode framework hardening is completed.

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
f1) User connects/follows YouTube sources (manual first, auto-ingestion later).
f2) New media becomes blueprint items in `My Feed`.
f3) User scans, remixes, and adds insights.
f4) Eligible items are promoted to channel feeds after gates.
f5) Community votes/comments to surface higher-value items.

## Route and IA Snapshot
r1) [have] Home: `/`
r2) [have] Feed: `/wall`
r3) [have] Explore: `/explore`
r4) [have] Channels index: `/channels`
r5) [have] Channel page: `/b/:channelSlug`
r6) [have] YouTube adapter page (manual v0): `/youtube`
r7) [have] Blueprint detail: `/blueprint/:blueprintId`
r8) [have] My Feed first-class route: `/my-feed`
r9) [have] Compatibility redirects: `/tags` -> `/channels`, `/blueprints` -> `/wall`

## Scope Boundaries (MVP)
s1) In scope
- YouTube adapter as first and only required adapter.
- Personal feed from pulled media.
- Channel publish gating and moderation-lite rules.
- Community interactions on shared blueprints (likes/comments).

s2) Out of scope
- Multi-adapter rollout in same MVP cut.
- Fully open free-form blog/social posting model.
- Full moderation platform for user-generated channels.

## Data Surfaces (Current + Direction)
d1) [have] `blueprints`, `blueprint_tags`, `blueprint_likes`, `blueprint_comments`.
d2) [have] `tag_follows`, `tags`, `profiles`, `mvp_events`.
d3) [have] Source ingestion + feed tables (`source_items`, `user_source_subscriptions`, `user_feed_items`).
d4) [have] Channel candidate + decision logs (`channel_candidates`, `channel_gate_decisions`).
d5) [todo] Scheduled auto-ingestion loop from source subscriptions.

## Next Milestone (Hardening)
n1) Keep production gate behavior stable with `CHANNEL_GATES_MODE=bypass`.
n2) Add `shadow` mode diagnostics without changing publish eligibility.
n3) Reserve `enforce` mode for non-prod verification until dedicated rollout approval.

## Key References
k1) Architecture: `docs/architecture.md`
k2) Program + project status: `docs/exec-plans/index.md`
k3) Active direction plan: `docs/exec-plans/active/bleuv1-source-first-program.md`
k4) YT2BP contract: `docs/product-specs/yt2bp_v0_contract.md`
