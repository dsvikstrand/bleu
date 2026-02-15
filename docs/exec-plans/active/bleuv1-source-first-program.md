# bleuV1 Source-First Program

Status: `active`

## 1) Problem Statement
Current product value is real but split across two identities:
- community-style blueprint posting
- source-to-blueprint utility

`bleuV1` resolves this by making source-ingested blueprints the primary supply while preserving community opinions through insights, comments, and voting.

## 2) Program Goal
Ship a coherent MVP that users can explain in one sentence:
- bite-sized blueprints from favorite media sources
- enriched by community insights

## 3) Direction Lock
1. Source-first content supply (YouTube adapter first).
2. Personal-first `My Feed` as unfiltered lane.
3. Channel feeds are shared, gated lanes.
4. User contribution is remix/insight on imported blueprints (not standalone free-form posting in MVP).

## 4) Scope
### In scope
- YouTube-only adapter MVP
- personal feed ingestion lifecycle
- channel candidate gate policy
- provenance and dedupe model
- community interactions (likes/comments/votes/insights)

### Out of scope
- multi-adapter expansion in same MVP cut
- open user-created channels
- full moderation suite

## 5) Core Lifecycle Contract
`source_item -> imported_blueprint -> my_feed -> channel_candidate -> channel_published|channel_rejected`

Rules:
- `My Feed` is allowed to be broader/noisier.
- Channel feeds must pass channel-fit + quality + safety + PII gates.
- Gate failures stay personal-only.

## 6) Execution Defaults (Lock)
1. Channel promotion default mode: `selected` (manual approve path).
2. Low-confidence channel candidates: block from channel, keep in My Feed.
3. Stop-and-inspect checkpoints: maximum 3 per milestone.
4. Orchestration control plane default: CLI-first (`codex exec`) + GitHub Actions, with VS Code for authoring/review.

## 7) Program Metrics (Initial)
- ingest success rate
- blueprint generation success rate
- cache hit rate for duplicate source pulls
- channel gate pass rate
- channel reject rate by reason
- comments/votes per channel-published blueprint
- D7 return rate for users with >=1 followed source

## 8) Phase Plan
1. Foundation (`active`): contract lock + docs/IA reset + lifecycle wiring plan.
2. MVP Build: My Feed + source follow mode + channel candidate gate.
3. MVP Validation: quality/cost/relevance tuning and GO/HOLD/PIVOT review.

## 9) Risks and Mitigations
1. Risk: noisy channel feeds from weak fit routing.
   - Mitigation: hard gate channel-fit before publish.
2. Risk: identity drift back to generic posting app.
   - Mitigation: keep standalone posting out of MVP core IA.
3. Risk: ingest cost spikes from duplicate pulls.
   - Mitigation: canonical source keys + cached artifacts.

## 10) Decision Log
- D-001: Codename for direction is `bleuV1`.
- D-002: MVP adapter scope starts with YouTube only.
- D-003: Channel publish is a gated second step.
- D-004: User value-add in MVP is insight/remix on imported blueprints.
