# Project 4 - Blueprint Detail Priority

Status: `completed (archived legacy direction)`

> Archived on 2026-02-14 after direction change to `bleuV1` source-first MVP.
> Blueprint-detail priorities for the new direction should be versioned under active `bleuV1` plans.

## Goal
Refocus blueprint detail page on content value and action clarity, with channel context prioritized over author prominence.

## In Scope
- above-the-fold hierarchy redesign
- content-first build notes and steps readability
- author metadata de-emphasis rules
- banner placement consistency rules

## Out Of Scope
- full comment/thread system redesign
- profile page redesign
- backend content generation logic changes

## Dependencies
- P2 density rules
- P3 channel context model

## Above-The-Fold Hierarchy (v0)
1. title
2. channel/context chips
3. value summary (what user gets)
4. primary action(s)
5. author metadata (muted, secondary)

## Banner Rules (v0)
- banner must not block core information hierarchy
- collapse/expand behavior must be consistent across generated and published contexts
- preserve readability when banner is absent

## Readability Rules
- step text should remain scannable in long blueprints
- keep line length and spacing tuned for mobile readability
- avoid over-dense blocks in instruction sections

## Step-by-Step Implementation Plan (for later execution)
1. audit current detail-page content order.
2. define target content hierarchy and component slots.
3. align banner behavior with draft/published consistency.
4. validate readability with long and short blueprints.

## Edge Cases / Failure Modes
- no banner available
- extremely long title or summary
- author-only content with weak channel mapping

## ST Checklist
- all major detail variants render with correct hierarchy
- banner behavior consistent in both contexts
- primary action remains visible without scrolling on common mobile viewport

## Acceptance Criteria
- users identify blueprint purpose in first screen view
- author metadata no longer dominates first visual hierarchy
- no regressions in core detail actions

## Done Definition
- exact detail states covered: with banner, without banner, long form, short form
- exact hierarchy documented in component order
- exact visual regression checklist prepared

## Rollback Notes
- maintain prior layout variant for quick rollback
- rollback can preserve channel chips while reverting section order
