# Project 2 - Feed Density

Status: `draft`

## Goal
Deliver a tighter, Reddit-like feed rhythm that improves scan speed without harming readability.

## In Scope
- reduce card chrome and stacked containers
- establish row-like feed rhythm
- define spacing and separator rules
- mobile + desktop constraints for dense layout

## Out Of Scope
- channel ranking logic
- backend/content model changes
- comments/thread UX redesign

## Dependencies
- P1 IA/lingo complete for consistent labels

## Visual Rules (v0)
1. avoid nested cards in feed surfaces.
2. minimize heavy borders; use separators and typography hierarchy.
3. keep metadata compact and secondary.
4. prioritize title + value summary + channel context.

## Layout Constraints
- Mobile:
  - tighter vertical spacing, predictable row rhythm
  - avoid oversized cards with excessive top/bottom padding
- Desktop:
  - preserve same hierarchy with wider columns
  - maintain scan-first structure

## Card-to-Row Transform Plan
1. identify all feed card variants.
2. define common row shell with consistent sections.
3. normalize metadata row (channel/tag/author/date priority).
4. normalize action row spacing and icon weight.

## Step-by-Step Implementation Plan (for later execution)
1. baseline screenshot inventory and spacing audit.
2. define token changes (spacing, radius, borders, shadows).
3. apply to primary feed components.
4. validate on mobile and desktop breakpoints.
5. run scan/readability QA on top 20 feed items.

## Edge Cases / Failure Modes
- dense layout makes long titles unreadable
- banner/image blocks dominate row height
- low-contrast metadata after density reduction

## ST Checklist
- mobile feed: top 10 items render without clipping/overlap
- desktop feed: same hierarchy preserved
- no nested container visual regression in target feed views

## Acceptance Criteria
- measurable reduction in container depth and empty vertical space
- feed feels continuous (border-to-border style) without readability loss
- no critical tap-target regressions on mobile

## Done Definition
- exact feed states covered: regular row, with banner, without banner, long title
- exact visual tokens documented
- exact regression checks defined and repeatable

## Rollback Notes
- keep previous style tokens branch-able for quick rollback
- revert only feed shell if specific density variant fails QA
