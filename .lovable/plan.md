
# Inventory Page Redesign

## Overview
Transform the Inventory page from a simple vertical list into a modern, discoverable interface with a card grid layout, personalized suggestions, tag-based filtering, and community engagement stats.

---

## Visual Design

### Layout Structure
```
+------------------------------------------+
|  Header                                   |
+------------------------------------------+
|  Title + Subtitle                        |
+------------------------------------------+
|  Search Bar                  [+ Create]   |
+------------------------------------------+
|  [#fitness] [#nutrition] [#skincare] ... | <- Tag filter chips
+------------------------------------------+
|  Suggested for You (if logged in)        |
|  +--------+  +--------+  +--------+       |
|  | Card 1 |  | Card 2 |  | Card 3 |       |
|  +--------+  +--------+  +--------+       |
+------------------------------------------+
|  All Inventories                          |
|  +--------+  +--------+  +--------+       |
|  |        |  |        |  |        |       |
|  +--------+  +--------+  +--------+       |
|  +--------+  +--------+  +--------+       |
|  ...                                      |
+------------------------------------------+
```

### Card Design
Each inventory card will display:
- Title (prominent)
- Description (truncated to 2 lines)
- Tag badges (max 3, then "+N more")
- Blueprint count (how many blueprints use this inventory)
- Like count + heart button
- Subtle hover glow effect

---

## Features

### 1. Card Grid Layout
- Responsive: 1 column mobile, 2 columns tablet, 3 columns desktop
- Compact cards with consistent height
- Warm hover glow matching the orange theme

### 2. Tag Filter Chips
- Horizontal scrollable row of popular tags
- Click to filter inventories by that tag
- Clear filter button when active
- Pull from most-used inventory tags

### 3. Suggested Inventories Section
- Personalized recommendations for logged-in users
- Based on: tags from user's liked inventories and created blueprints
- Fallback to "Popular" for guests/new users
- Horizontal scroll or 3-card row

### 4. Community Stats on Cards
- Blueprint count badge (e.g., "23 blueprints")
- Shows how active/popular each inventory is
- Helps users discover well-tested inventories

---

## Technical Implementation

### New Hook: `useSuggestedInventories`
```typescript
// src/hooks/useSuggestedInventories.ts
// Logic:
// 1. For authenticated users: find tags from their liked inventories
// 2. Query inventories with those tags that user hasn't interacted with
// 3. Fallback to most-liked inventories
```

### New Hook: `usePopularInventoryTags`
```typescript
// src/hooks/usePopularInventoryTags.ts
// Query inventory_tags to find most-used tags across inventories
```

### Database Query Addition
- Join with `blueprints` table to get blueprint count per inventory
- Or add a `blueprint_count` aggregation to the hydrate function

### Page Updates (`src/pages/Inventory.tsx`)
1. Add ambient background effects (matching Tags page)
2. Replace vertical list with CSS grid
3. Add tag filter chip row
4. Add "Suggested for You" section
5. Update card component with stats and compact design
6. Add responsive grid classes

### Files to Create/Edit
| File | Action |
|------|--------|
| `src/hooks/useSuggestedInventories.ts` | Create |
| `src/hooks/usePopularInventoryTags.ts` | Create |
| `src/hooks/useInventories.ts` | Add blueprint count to hydration |
| `src/pages/Inventory.tsx` | Rewrite with new layout |

---

## User Experience Flow

1. **New user lands on page**: Sees popular inventories in a clean grid, tag chips for quick filtering
2. **Searching**: Type to filter, or click tag chips for instant filtering
3. **Logged-in user**: Sees personalized "Suggested for You" section at top
4. **Clicking a card**: Navigates to builder page for that inventory
5. **Liking**: Heart button works inline without navigation

---

## Accessibility
- Keyboard navigable tag chips
- ARIA labels on interactive elements
- Focus-visible states on cards
- Screen reader friendly badge descriptions
