export type LibraryDomain = 'skincare' | 'fitness' | 'nutrition' | 'productivity' | 'general';
export type AudienceLevel = 'beginner' | 'intermediate' | 'advanced';
export type WritingStyle = 'friendly' | 'practical' | 'coach' | 'clinical';
export type StrictnessLevel = 'low' | 'medium' | 'high';
export type LengthHint = 'short' | 'medium' | 'long';

export type BlueprintFocus =
  | 'starter'
  | 'hydration'
  | 'weekly-reset'
  | 'barrier-care'
  | 'strength-basics'
  | 'hypertrophy'
  | 'conditioning'
  | 'mobility'
  | 'recovery-day'
  | 'balanced-basics'
  | 'protein-focus'
  | 'meal-prep'
  | 'morning-focus'
  | 'daily-plan'
  | 'deep-work'
  | 'evening-reset'
  | 'weekly-review';

export type VarietyLevel = 'low' | 'medium' | 'high';
export type CautionLevel = 'conservative' | 'balanced' | 'aggressive';

export const LIBRARY_DOMAIN_OPTIONS: Array<{ value: LibraryDomain; label: string }> = [
  { value: 'skincare', label: 'Skincare' },
  { value: 'fitness', label: 'Fitness' },
  { value: 'nutrition', label: 'Nutrition' },
  { value: 'productivity', label: 'Productivity' },
  { value: 'general', label: 'General' },
];

export const AUDIENCE_OPTIONS: Array<{ value: AudienceLevel; label: string }> = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
];

export const STYLE_OPTIONS: Array<{ value: WritingStyle; label: string }> = [
  { value: 'friendly', label: 'Friendly' },
  { value: 'practical', label: 'Practical' },
  { value: 'coach', label: 'Coach' },
  { value: 'clinical', label: 'Clinical' },
];

export const STRICTNESS_OPTIONS: Array<{ value: StrictnessLevel; label: string }> = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];

export const LENGTH_OPTIONS: Array<{ value: LengthHint; label: string }> = [
  { value: 'short', label: 'Short' },
  { value: 'medium', label: 'Medium' },
  { value: 'long', label: 'Long' },
];

export const BLUEPRINT_FOCUS_OPTIONS: Array<{ value: BlueprintFocus; label: string; domains?: LibraryDomain[] }> = [
  { value: 'starter', label: 'Quick Starter' },
  { value: 'hydration', label: 'Hydration Focus', domains: ['skincare', 'nutrition'] },
  { value: 'weekly-reset', label: 'Weekly Reset', domains: ['skincare', 'productivity', 'general'] },
  { value: 'barrier-care', label: 'Barrier Care', domains: ['skincare'] },
  { value: 'strength-basics', label: 'Strength Basics', domains: ['fitness'] },
  { value: 'hypertrophy', label: 'Hypertrophy', domains: ['fitness'] },
  { value: 'conditioning', label: 'Conditioning', domains: ['fitness'] },
  { value: 'mobility', label: 'Mobility', domains: ['fitness'] },
  { value: 'recovery-day', label: 'Recovery Day', domains: ['fitness'] },
  { value: 'balanced-basics', label: 'Balanced Basics', domains: ['nutrition'] },
  { value: 'protein-focus', label: 'Protein Focus', domains: ['nutrition'] },
  { value: 'meal-prep', label: 'Meal Prep', domains: ['nutrition'] },
  { value: 'morning-focus', label: 'Morning Focus', domains: ['productivity', 'general'] },
  { value: 'daily-plan', label: 'Daily Plan', domains: ['productivity'] },
  { value: 'deep-work', label: 'Deep Work', domains: ['productivity'] },
  { value: 'evening-reset', label: 'Evening Reset', domains: ['productivity', 'general'] },
  { value: 'weekly-review', label: 'Weekly Review', domains: ['productivity'] },
];

export function formatTitleCase(input: string) {
  const cleaned = String(input || '')
    .trim()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');
  return cleaned
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function libraryControlsToTopic(controls: {
  domain: LibraryDomain;
  audience: AudienceLevel;
  length: LengthHint;
}) {
  const d = controls.domain;
  const a = controls.audience;
  const len = controls.length;

  const base = (() => {
    if (d === 'skincare') return 'home skincare routine';
    if (d === 'fitness') return 'home strength workout';
    if (d === 'nutrition') return 'healthy daily nutrition';
    if (d === 'productivity') return 'daily focus routine';
    return 'life routine essentials';
  })();

  const aud = a === 'beginner' ? 'for beginners' : a === 'advanced' ? 'for advanced users' : 'for intermediate users';
  const size = len === 'short' ? 'simple' : len === 'long' ? 'detailed' : 'practical';
  return `${size} ${base} ${aud}`;
}

export function libraryControlsToInstructions(controls: {
  domain: LibraryDomain;
  audience: AudienceLevel;
  style: WritingStyle;
  strictness: StrictnessLevel;
  length: LengthHint;
  notes?: string;
}) {
  const parts: string[] = [];
  parts.push('Mode: controls_v0');
  parts.push(`Domain: ${controls.domain}`);
  parts.push(`Audience: ${controls.audience}`);
  parts.push(`Style: ${controls.style}`);
  parts.push(`Strictness: ${controls.strictness}`);
  parts.push(`Length: ${controls.length}`);
  if (controls.notes && controls.notes.trim()) parts.push(`Notes: ${controls.notes.trim()}`);
  return parts.join(' | ');
}

export function blueprintControlsToTitle(focus: BlueprintFocus) {
  const map: Record<string, string> = {
    starter: 'Quick Starter',
    hydration: 'Hydration Focus',
    'weekly-reset': 'Weekly Reset',
    'barrier-care': 'Barrier Care',
    'strength-basics': 'Strength Basics',
    hypertrophy: 'Hypertrophy Focus',
    conditioning: 'Conditioning Sprint',
    mobility: 'Mobility and Recovery',
    'recovery-day': 'Recovery Day',
    'balanced-basics': 'Balanced Basics',
    'protein-focus': 'Protein Focus',
    'meal-prep': 'Meal Prep Plan',
    'morning-focus': 'Morning Focus Block',
    'daily-plan': 'Daily Plan',
    'deep-work': 'Deep Work Sprint',
    'evening-reset': 'Evening Reset',
    'weekly-review': 'Weekly Review',
  };
  return map[focus] || formatTitleCase(focus);
}

export function blueprintControlsToDescription(focus: BlueprintFocus, domain: LibraryDomain) {
  const f = String(focus).replace(/-/g, ' ');
  if (domain === 'skincare') return `A ${f} routine that stays gentle and beginner friendly.`;
  if (domain === 'fitness') return `A ${f} routine built for safe form and realistic progression.`;
  if (domain === 'nutrition') return `A ${f} routine focused on sustainable daily habits.`;
  if (domain === 'productivity') return `A ${f} routine designed for low-friction repeatability.`;
  return `A ${f} routine aligned with your library.`;
}

export function blueprintControlsToNotes(controls: {
  focus: BlueprintFocus;
  length: LengthHint;
  strictness: StrictnessLevel;
  variety: VarietyLevel;
  caution: CautionLevel;
  notes?: string;
}) {
  const parts: string[] = [];
  parts.push('Mode: controls_v0');
  parts.push(`Focus: ${controls.focus}`);
  parts.push(`Length: ${controls.length}`);
  parts.push(`Strictness: ${controls.strictness}`);
  parts.push(`Variety: ${controls.variety}`);
  parts.push(`Caution: ${controls.caution}`);
  if (controls.notes && controls.notes.trim()) parts.push(`Notes: ${controls.notes.trim()}`);
  return parts.join(' | ');
}

