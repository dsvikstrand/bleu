# bleuV1 Lifecycle And State Machine

## Canonical Lifecycle
`source_item -> imported_blueprint -> my_feed -> channel_candidate -> channel_published|channel_rejected`

## State Definitions
1. `source_discovered`
- Source item identified from user pull or followed source.

2. `source_normalized`
- Source metadata/transcript normalized with canonical identity.

3. `blueprint_generated`
- Imported blueprint draft generated from source.

4. `my_feed_published`
- Item available in personal lane.

5. `candidate_submitted`
- Item submitted for channel promotion decision.

6. `candidate_evaluated_pass`
- All gate criteria passed for channel publish.

7. `candidate_evaluated_fail`
- One or more required gates failed.

8. `channel_published`
- Shared channel publication completed.

9. `channel_rejected`
- Candidate not published to channel and recorded with reason code(s).

## Actor Ownership Per Transition
System-owned transitions
- `source_discovered -> source_normalized`
- `source_normalized -> blueprint_generated`
- `blueprint_generated -> my_feed_published`
- `candidate_submitted -> candidate_evaluated_pass|candidate_evaluated_fail`
- `candidate_evaluated_pass -> channel_published`
- `candidate_evaluated_fail -> channel_rejected`

User-owned transitions
- `my_feed_published -> candidate_submitted`
- optional remix/insight updates attached to blueprint

Moderator/admin-owned transitions (future-compatible)
- override reject to publish (policy exception path)
- force unpublish in channel for trust/safety reasons

## Retry Paths
System retries
- transient ingestion failures (`network`, `rate_limited`, `timeout`)
- transient generation failures with bounded retries

No automatic retries
- hard policy failures (`safety`, `pii`, severe channel-fit mismatch)

User retries
- re-submit candidate after remix/insight edits when policy permits

## Terminal States
- `channel_published`
- `channel_rejected`

Terminal state invariants
- Terminal decisions require persisted reason-code audit trail.
- `channel_rejected` item remains available in My Feed unless explicitly removed by user policy.

## Invalid Transitions
- `source_discovered -> channel_published` (skips required generation and gate stages)
- `my_feed_published -> channel_published` (skips candidate evaluation)
- `candidate_evaluated_fail -> channel_published` without explicit override path
- `channel_rejected -> channel_published` without re-evaluation or override record

## Decision Guarantees
1. Channel publish is never unconditional.
2. My Feed publication does not imply channel eligibility.
3. Channel gate failure does not remove personal access by default.

## Stop-And-Inspect Alignment
Checkpoint 1 (scope identity)
- confirm lifecycle still enforces source-first and channel-gated distribution.

Checkpoint 2 (state ownership)
- verify actor ownership and retry policy remain decision-complete.

Checkpoint 3 (phase close)
- verify invalid transitions and terminal invariants are reflected in implementation specs.
