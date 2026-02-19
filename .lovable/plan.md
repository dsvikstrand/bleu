

# Landing Page Cold-User Optimization + Build Fixes

## Overview
This plan fixes the build errors blocking the app from loading, then restructures the homepage to convert cold (anonymous) visitors more effectively based on our previous review feedback.

## Part 1: Fix Build Errors (3 files)

### 1a. `server/llm/openaiClient.ts` — Type casting issues
- Add explicit type assertions for Zod `.parse()` return values (lines 105, 165, 179) so they match the expected return types (`InventorySchema`, `BlueprintGenerationResult`, `YouTubeBlueprintResult`)
- Cast `imageSize` and `imageQuality` string env vars to the expected OpenAI SDK literal union types (lines 126-127)

### 1b. `src/components/blueprint/SuggestedBlueprints.tsx` — Prop mismatch
- Remove `followedTagIds` and `onToggleTag` props being passed to `BlueprintCard` (lines 55-56), since `BlueprintCardProps` doesn't accept them. Replace with the supported `onTagClick` prop if tag interaction is needed.

### 1c. `src/hooks/useMyFeed.ts` — Supabase type mismatch
- The generated Supabase types don't recognize `user_feed_items`, `source_items`, and `channel_candidates` tables. Add `as any` casts on the `.from()` calls to bypass the type checker until the types file is regenerated. This is the standard workaround when Supabase types are out of sync.

## Part 2: Homepage Cold-User Optimization

### 2a. Simplify the Hero CTA section
**Problem:** 4-5 buttons create decision paralysis for anonymous users.
**Fix:** For anonymous users, show exactly 2 CTAs:
- Primary: "Try a YouTube URL" (links to `/youtube`)
- Secondary: "See an example" (anchor to `#landing-proof`)
- Remove "Sign in to save and follow channels" as a hero-level CTA (it's already in the header)

### 2b. Rewrite sub-headline for benefits
**Current:** "Save time by extracting clear steps from long videos, then reuse or share the best blueprints with your community."
**New:** "Paste a YouTube link, get a step-by-step guide in seconds. No signup needed to try it."
- Emphasizes zero friction and instant value

### 2c. Reorder page sections for cold users
**Current order:** Hero -> Proof Card -> Use Cases -> How it Works -> Discover Routines -> Top Blueprints -> Tags
**New order:** Hero -> How it Works (3 steps) -> Proof Card -> Use Cases -> Discover Routines -> Top Blueprints -> Tags
- "How it works" should come immediately after the hero so cold users understand the product before seeing examples

### 2d. Remove "Example set" badges from fallback content
- When there's no live data, `TopBlueprints` and `FeaturedTags` show "Example set" badges. This signals "this platform is empty" to cold users. Remove these badges and let fallback content appear as real content.

### 2e. Tighten "How it works" copy
- Step 1: "Paste a link" (not "Choose a video" -- simpler language)
- Step 2: "Get action steps" (keep)
- Step 3: "Save or share" (not "Share what works" -- lower commitment)
- Remove the secondary nav buttons below How it Works ("Browse Home", "Explore Channels") for anonymous users -- these are meaningless to someone who hasn't used the app yet

### 2f. Remove internal jargon from use case benefit chips
**Current bottom chips:** "Save time by skipping replay loops", "Extract clear steps from long-form videos", "Reuse and share useful playbooks in Home"
- "Home" is internal jargon. Change to: "Reuse and share useful playbooks with others."

## Files Changed

| File | Change |
|------|--------|
| `server/llm/openaiClient.ts` | Type assertion fixes (5 lines) |
| `src/components/blueprint/SuggestedBlueprints.tsx` | Remove unsupported props (2 lines) |
| `src/hooks/useMyFeed.ts` | Add `as any` casts on `.from()` calls (3 lines) |
| `src/pages/Home.tsx` | Simplify hero CTAs, reorder sections, clean copy |
| `src/components/home/TopBlueprints.tsx` | Remove "Example set" badge |
| `src/components/home/FeaturedTags.tsx` | Remove "Example set" badge |
| `src/components/home/LandingUseCases.tsx` | Fix "Home" jargon in benefit chip |

