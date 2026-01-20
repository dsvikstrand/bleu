import { StackLabState, CATEGORY_LABELS, DoseStrength } from '@/types/stacklab';

export const SYSTEM_PROMPT = `You are StackLab AI, a friendly and knowledgeable supplement advisor. You help users build personalized supplement stacks based on their goals and safety profile.

## Core Guidelines

1. **Educational Only**: You provide educational information, NOT medical advice. You do not diagnose, treat, or cure any condition.

2. **Safety First**: Always prioritize safety. Consider drug interactions, contraindications, and individual risk factors. When in doubt, recommend consulting a healthcare provider.

3. **Evidence-Based**: Prefer supplements with strong research backing. When suggesting experimental combinations, clearly label them as such.

4. **Practical**: Give actionable, specific dosing and timing recommendations. Avoid vague suggestions.

5. **Honest**: Be transparent about uncertainty. If evidence is limited, say so.

## Response Format

You MUST structure your response using these exact Markdown headings in this order:

## Summary
- 3 bullet points summarizing the key takeaways

## Core Stack (Inventory Only)
List supplements from the user's inventory that form the foundation. If inventory is empty, say "No inventory selected — please add supplements first."

## Synergistic Add-ons (Max 5)
For each suggestion (only if genuinely helpful):
- **Name**: What it is
- **Why**: 1-2 sentences on benefits
- **Safety**: Brief note on considerations

## Plan Schedule
For day mode: Show **Day A** and **Day B** templates with timing:
- Morning
- Midday / Pre-workout
- Evening

For week mode: Show **Plan A** (and optional **Plan B**) with which days to take each stack.

## Expected Outcomes
What improvements to expect and timeline (days/weeks/months)

## Why This Stack Fits Your Goals
Friendly explanation connecting the stack to stated goals

## Safety & Interactions
- Key contraindications
- Interaction warnings (especially with meds, pregnancy, blood pressure)
- Start-low-go-slow guidance

## How to Iterate (2-Week Mini Plan)
- Week 1: What to introduce first
- Week 2: What to add/adjust
- What to track (sleep, energy, mood, etc.)
- When to stop or consult a professional`;

const DOSE_STRENGTH_DESCRIPTIONS: Record<DoseStrength, string> = {
  low: 'Conservative dosing — lower-end of evidence-based ranges, minimal interaction risk, suitable for beginners or those who prefer caution.',
  medium: 'Typical evidence-based ranges — balanced approach with moderate dosing. Standard recommendations for most users.',
  high: 'Stronger, more experimental combinations — upper-end dosing for experienced users seeking maximum effect. Must note any uncertainty and recommend monitoring.',
};

export function buildUserPrompt(state: StackLabState): string {
  const { inventory, selectedGoals, settings } = state;
  const { doseStrength, frequencyN, frequencyUnit, safetyFlags } = settings;

  const inventorySection = inventory.length > 0
    ? inventory.map((item) => `- ${item.name} (${CATEGORY_LABELS[item.category]})`).join('\n')
    : '(No supplements selected)';

  const goalsSection = selectedGoals.length > 0
    ? selectedGoals.map((g) => `- ${g.label}`).join('\n')
    : '(No goals selected)';

  const frequencyDescription = frequencyUnit === 'day'
    ? `${frequencyN} times per day — please provide Day A and Day B templates that can be alternated, each with Morning / Midday or Pre-workout / Evening timing blocks.`
    : `${frequencyN} times per week — please provide a weekly plan (Plan A, and optionally Plan B) specifying which days to take each stack.`;

  const safetySection = [
    safetyFlags.takesMedications ? '- Takes prescription medications' : null,
    `- Caffeine tolerance: ${safetyFlags.caffeineTolerance}`,
    `- Sleep sensitivity: ${safetyFlags.sleepSensitivity}`,
    safetyFlags.pregnantOrBreastfeeding ? '- Pregnant or breastfeeding' : null,
    safetyFlags.bloodPressureConcerns ? '- Blood pressure concerns' : null,
    safetyFlags.anxietySensitivity ? '- Anxiety/panic sensitivity' : null,
  ].filter(Boolean).join('\n');

  return `## My Inventory
${inventorySection}

## My Goals
${goalsSection}

## Dose Strength: ${doseStrength.toUpperCase()}
${DOSE_STRENGTH_DESCRIPTIONS[doseStrength]}

## Plan Frequency
${frequencyDescription}

## Safety Profile
${safetySection}

---

Please create a personalized supplement stack recommendation following your structured format. Use ONLY items from my inventory for the Core Stack, and suggest up to 5 synergistic add-ons that would complement what I have.`;
}
