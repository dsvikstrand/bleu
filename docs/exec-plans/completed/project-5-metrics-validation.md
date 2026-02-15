# Project 5 - Metrics And Validation

Status: `completed (archived legacy direction)`

> Archived on 2026-02-14 after direction change to `bleuV1` source-first MVP.
> New metric contracts are tracked under active `bleuV1` plans.

## Goal
Validate Channels-first UX impact with measurable outcomes and explicit GO/HOLD/PIVOT rules.

## In Scope
- event list and metric formulas
- pilot cohort definition
- reporting template and cadence
- decision rules tied to program SUCC thresholds

## Out Of Scope
- A/B experimentation platform setup
- advanced attribution modeling
- non-UX product metrics expansion

## Dependencies
- P1-P4 instrumentation points defined

## Required Events (v0)
- `channel_view`
- `channel_follow`
- `channel_unfollow`
- `feed_item_open`
- `detail_view`
- `detail_primary_action`
- `first_useful_blueprint_reached`

## Metric Formulas
1. `clarity_rate`
   - users who pass post-session value comprehension prompt / total sampled users
2. `follow_intent_rate`
   - users with >=1 follow in first session / total first-session users
3. `feed_to_detail_open_rate`
   - detail opens / feed impressions
4. `detail_to_publish_or_save_intent`
   - publish or save intent actions / detail views (eligible contexts)
5. `time_to_first_useful_blueprint`
   - median seconds from session start to first meaningful detail interaction

## Pilot Setup
- cohort: new users + returning users split
- window: 7 days initial pilot
- reporting cadence: daily short report + weekly decision review

## GO/HOLD/PIVOT Rules
- GO: all core thresholds met or exceeded
- HOLD: mixed results with clear localized remediation path
- PIVOT: multiple core thresholds miss with no short remediation path

## Step-by-Step Implementation Plan (for later execution)
1. confirm event instrumentation inventory from P1-P4.
2. implement/verify event payload contracts.
3. run pilot window and collect daily snapshots.
4. compute metrics against thresholds.
5. publish decision memo with next actions.

## Edge Cases / Failure Modes
- missing events due to UI path differences
- double-counting from retry/refresh behavior
- low cohort size causing noisy rates

## ST Checklist
- event fire tests for all mandatory events
- metric calculator reproducibility checks
- report template completeness check

## Acceptance Criteria
- all required metrics computable from available events
- weekly report includes threshold comparison and decision state
- decision framework executed without ad-hoc criteria changes

## Done Definition
- exact event list and payload fields are locked
- exact metric formulas and denominators documented
- exact report template committed

## Rollback Notes
- if instrumentation quality fails, freeze decisions and extend pilot with corrected tracking
- keep threshold definitions fixed unless explicitly versioned
