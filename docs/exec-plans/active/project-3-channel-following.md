# Project 3 - Channel Following

Status: `draft`

## Goal
Introduce follow/unfollow channel behavior and channel-prioritized feed logic for personalization.

## In Scope
- channel follow/unfollow UX states
- channel feed anatomy
- cold-start behavior for users with zero follows
- following-priority ranking policy (design-level)

## Out Of Scope
- user-created channels
- advanced moderation workflow
- full recommendation engine

## Dependencies
- P1 terminology and taxonomy
- P2 feed row structure

## Channel Feed Behavior (v0)
1. user with follows: show followed-channel content first.
2. user with zero follows: show curated starter channels and prompt follow.
3. fallback when channel data sparse: blend with global feed.

## Channel Page Anatomy (v0)
- channel header (name + short purpose)
- follow/unfollow control
- top posts section
- recent posts section

## Step-by-Step Implementation Plan (for later execution)
1. define follow state machine and UI transitions.
2. define ranking precedence rules.
3. define channel page sections and order.
4. define cold-start prompts and defaults.
5. validate follow loop end-to-end (discover -> follow -> feed impact).

## Edge Cases / Failure Modes
- channel has no content
- user follows channels with overlapping content causing duplicates
- stale follow state in UI

## ST Checklist
- follow and unfollow state updates correctly on all relevant surfaces
- feed reflects follow state change after action
- zero-follow state always shows actionable next step

## Acceptance Criteria
- users can follow channel in <=2 taps from Explore
- followed channels visibly affect home feed ordering
- no dead-end states for zero-follow users

## Done Definition
- exact states complete: unfollowed, followed, loading, empty-channel
- exact metrics events listed for P5
- exact regression checks for state sync defined

## Rollback Notes
- if ranking causes major noise, fallback to global feed with follow prompts preserved
- feature flag-friendly sequencing recommended in implementation
