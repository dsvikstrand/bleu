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
4. Keep identity stable: source-first, My Feed first, gated channel publish second.

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
