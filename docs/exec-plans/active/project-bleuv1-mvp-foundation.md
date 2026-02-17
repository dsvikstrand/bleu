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
3. Channel promotion default mode is selected/manual approve.
4. User value-add is insight/remix on imported blueprints; no standalone free-form post model in MVP core.
5. Low-confidence channel candidates are blocked from channel and retained in My Feed.
6. Current production gate runtime mode is `CHANNEL_GATES_MODE=bypass` until enforcement rollout is explicitly approved.

## Current Workstreams
### W1 - My Feed As First-Class Surface
- Introduce/finish personal unfiltered feed lane behavior.
- Ensure channel fail does not remove personal access.
- Hide legacy no-blueprint pending/skipped rows during migration cleanup.

### W2 - Channel Candidate Gating
- Keep promotion as explicit second step from My Feed.
- Preserve quality/safety/channel-fit constraints while production mode remains bypass-first.

### W3 - YouTube Pull And Caching
- Keep YouTube-first ingestion flow stable.
- Reuse generated artifacts for duplicate pulls when canonical source id matches.
- Keep optional review/banner enhancement as separate post-generation steps to reduce core latency bottlenecks.

### W4 - Community Value Layer
- Keep insights/remixes tied to imported blueprints.
- Maintain vote/comment utility on shared channel content.

### W5 - Subscription Intake And Sync
- Support YouTube channel subscriptions with auto-only MVP UX.
- First subscribe sets checkpoint only (new-uploads-only, no historical prefill).
- Insert persistent `subscription_notice` item in My Feed per subscribed channel.
- Keep sync/deactivate and pending accept/skip endpoints as compatibility/operator paths.
- Keep debug simulation endpoint env-gated (`ENABLE_DEBUG_ENDPOINTS`) for non-prod ingestion testing.
- Run scheduler trigger from Oracle (`/api/ingestion/jobs/trigger` with service auth).

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
