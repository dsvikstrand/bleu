
# Blueprint Builder UX Improvement Plan

## Overview

This plan improves the "Mix" page (InventoryBuild.tsx) to make the step-based flow more intuitive and visually clear. Based on your preferences:

- **Steps Layout**: Vertical accordion with one step expanded at a time
- **Help System**: Floating tooltips + optional guided tour (activated by button)
- **Item Selection**: Keep current auto-add behavior (items go to latest step)
- **Add Step Flow**: Quick-add button that creates inline-editable steps

---

## Key Changes

### 1. Vertical Accordion for Steps

**Current Issue**: Steps are displayed as flat cards with everything visible, making the page feel cluttered.

**Solution**: Convert to a proper accordion where:
- Only one step is expanded at a time (the "active" step)
- Collapsed steps show: Step number, title, item count badge
- Expanded step shows: Title (inline editable), description, items with context inputs
- The "current step" (latest) auto-expands by default
- Visual indicator shows which step receives new items

**Layout Structure**:
```text
+------------------------------------------+
|  [+] Add Step                            |
+------------------------------------------+
|  ▼ Step 1: Clean Face         3 items    |  <- Expanded (active)
|    +--------------------------------------+
|    | Description: [Start with basics...] |
|    +--------------------------------------+
|    | • Cleanser      [gentle, AM/PM]     |
|    | • Toner         [2 pumps]           |
|    | • Micellar      [PM only]           |
|    +--------------------------------------+
+------------------------------------------+
|  ▶ Step 2: Treatment          2 items    |  <- Collapsed
+------------------------------------------+
|  ▶ Step 3: Moisturize         1 item     |  <- Collapsed
+------------------------------------------+
```

### 2. Quick-Add Step Button

**Current Issue**: The add step form (title + description inputs) takes up space and feels disconnected.

**Solution**: 
- Replace with a single "+ Add Step" button at the top of the steps section
- Clicking creates a new step with placeholder title "Step N"
- Step title is inline-editable (click to edit, similar to renaming a file)
- Description is optional, editable when step is expanded
- New step auto-expands and becomes the "active" step

### 3. Active Step Indicator

**Current Issue**: Users don't know which step receives new items when they click in the picker.

**Solution**:
- The expanded step is the "active" step (receives new items)
- Show a subtle "ACTIVE" or "CURRENT" badge on the expanded step
- Brief highlight animation when an item is added
- Optional: "Items you select will be added here" hint inside active step

### 4. Floating Tooltips Help System

**New Component**: `BuildPageHelpOverlay.tsx`

**Behavior**:
- A small "?" help button floats in the corner of the build section
- When clicked, displays floating labels next to each major UI element:
  - Picker: "Select items from inventory categories"
  - Steps: "Organize items into ordered steps"
  - Active step: "Selected items appear here automatically"
  - Add Step: "Create a new step for your routine"
  - Context input: "Add notes like dosage or timing"
- Click anywhere or press Escape to dismiss
- Labels are small, non-modal, and positioned smartly to avoid overlap

### 5. Optional Guided Tour

**New Component**: `BuildPageTour.tsx`

**Behavior**:
- "Take a tour" button appears in the help tooltip or as a first-time callout
- When activated, highlights UI elements one at a time with explanatory text:
  1. "Browse items by category" (highlights picker)
  2. "Click an item to select it" (highlights item badge)
  3. "Items flow into your active step" (highlights steps)
  4. "Add context like dosage or timing" (highlights context input)
  5. "Create more steps to organize your routine" (highlights Add Step)
  6. "When ready, hit Mix for AI analysis" (highlights MIX button)
- User clicks "Next" to advance, "Skip" to close
- Stores completion in localStorage so it doesn't repeat

---

## Implementation Details

### New Files to Create

| File | Purpose |
|------|---------|
| `src/components/blueprint/StepAccordion.tsx` | Collapsible step component with inline editing |
| `src/components/blueprint/BuildHelpOverlay.tsx` | Floating tooltip help system |
| `src/components/blueprint/BuildTour.tsx` | Step-by-step guided tour |

### Files to Modify

| File | Changes |
|------|---------|
| `src/pages/InventoryBuild.tsx` | Replace steps card with new accordion, add help button, integrate tour |
| `src/components/blueprint/BuildPageGuide.tsx` | Minor: ensure it works with new layout |

---

## Component Specifications

### StepAccordion Component

**Props**:
```typescript
interface StepAccordionProps {
  steps: BlueprintStep[];
  activeStepId: string | null;
  onSetActive: (stepId: string) => void;
  onUpdateStep: (stepId: string, updates: Partial<BlueprintStep>) => void;
  onRemoveStep: (stepId: string) => void;
  onReorderSteps: (fromIndex: number, toIndex: number) => void;
  onRemoveItem: (stepId: string, itemKey: string) => void;
  onUpdateItemContext: (itemKey: string, context: string) => void;
  itemContexts: Record<string, string>;
}
```

**Features**:
- Renders each step as a collapsible panel
- Only one step open at a time
- Drag handle for reordering
- Inline title editing (double-click or edit icon)
- Item list with context inputs
- Remove item and remove step buttons
- "ACTIVE" badge on expanded step
- Empty state: "Select items from the inventory above"

### BuildHelpOverlay Component

**Props**:
```typescript
interface BuildHelpOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onStartTour: () => void;
}
```

**Positioning Logic**:
- Uses portal to render at document root
- Calculates positions based on target element refs
- Uses fixed positioning with smart offset
- Backdrop click dismisses

**Tooltip Content**:
```typescript
const HELP_TOOLTIPS = [
  { id: 'picker', text: 'Browse and select items by category' },
  { id: 'steps', text: 'Organize your items into ordered steps' },
  { id: 'active-step', text: 'Selected items appear here' },
  { id: 'add-step', text: 'Create a new step in your routine' },
  { id: 'context', text: 'Add notes like "2 drops" or "morning"' },
  { id: 'mix', text: 'Generate AI analysis of your blueprint' },
];
```

### BuildTour Component

**Props**:
```typescript
interface BuildTourProps {
  isActive: boolean;
  onComplete: () => void;
  onSkip: () => void;
}
```

**Tour Steps**:
1. Highlight item picker - "Browse items by category. Click to select."
2. Highlight step accordion - "Items flow into your active step."
3. Highlight Add Step button - "Create steps to organize your routine."
4. Highlight context input (if items exist) - "Add context like dosage or timing."
5. Highlight MIX button - "When ready, hit Mix for AI analysis!"

**State Management**:
- `localStorage.getItem('blueprint_build_tour_completed')`
- First-time visitors see a subtle "New here? Take a quick tour" banner

---

## Visual Design Notes

### Accordion Styling
- Collapsed: `bg-muted/30 hover:bg-muted/50` 
- Expanded: `bg-card border-primary/30 shadow-sm`
- Active badge: Small green/primary badge next to title

### Help Overlay
- Tooltips: Dark background with arrow pointing to element
- "?" button: Fixed position, bottom-right of the steps section
- Semi-transparent backdrop when active

### Tour
- Spotlight effect: Dim everything except highlighted element
- Card overlay with title + description + Next/Skip buttons
- Progress dots showing current step

---

## Implementation Order

| Step | Task |
|------|------|
| 1 | Create `StepAccordion.tsx` component |
| 2 | Refactor `InventoryBuild.tsx` to use new accordion |
| 3 | Add "+ Add Step" quick-add button |
| 4 | Add inline title editing to steps |
| 5 | Create `BuildHelpOverlay.tsx` component |
| 6 | Add "?" help button to the page |
| 7 | Create `BuildTour.tsx` component |
| 8 | Add tour trigger (button + first-time callout) |
| 9 | Test and polish animations/transitions |

---

## Expected Outcomes

1. **Cleaner visual hierarchy** - One expanded step at a time reduces cognitive load
2. **Clearer active step** - Users know exactly where items will appear
3. **Faster step creation** - One-click add, inline editing
4. **Discoverable help** - "?" button available without cluttering the UI
5. **Optional onboarding** - Tour for first-timers, skippable for experienced users
