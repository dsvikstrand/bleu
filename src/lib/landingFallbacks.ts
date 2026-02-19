export interface LandingFallbackBlueprint {
  title: string;
  summary: string;
  channel: string;
  tags: string[];
  href: string;
}

export interface LandingUseCase {
  id: string;
  title: string;
  description: string;
  href: string;
}

export interface LandingFallbackTag {
  slug: string;
  href: string;
}

export const FALLBACK_PROOF_BLUEPRINT: LandingFallbackBlueprint = {
  title: 'Build a 20-Minute Evening Reset Routine',
  summary:
    'A concise, step-by-step routine that helps you wind down faster using clear actions you can apply tonight.',
  channel: 'Productivity and Focus',
  tags: ['sleep', 'evening-routine', 'focus'],
  href: '/youtube',
};

export const FALLBACK_TOP_BLUEPRINTS: LandingFallbackBlueprint[] = [
  {
    title: 'Prep a High-Protein Meal Plan in 30 Minutes',
    summary: 'Convert one cooking video into a repeatable weekly prep flow with portion and timing cues.',
    channel: 'Cooking and Home Kitchen',
    tags: ['meal-prep', 'nutrition', 'beginner'],
    href: '/youtube',
  },
  {
    title: 'Beginner Full-Body Workout Blueprint',
    summary: 'Get a clear weekly structure, exercise order, and progression notes from a single fitness video.',
    channel: 'Fitness and Training',
    tags: ['workout', 'strength', 'beginner'],
    href: '/youtube',
  },
  {
    title: 'Study Sprint Blueprint for Better Retention',
    summary: 'Turn long study advice into a practical session template with setup, focus blocks, and review steps.',
    channel: 'Learning and Study',
    tags: ['study', 'learning', 'focus'],
    href: '/youtube',
  },
  {
    title: 'Simple Morning System for Busy Days',
    summary: 'Extract a short, realistic morning checklist from creator workflows and make it easy to follow daily.',
    channel: 'Productivity and Focus',
    tags: ['morning', 'habits', 'planning'],
    href: '/youtube',
  },
];

export const FALLBACK_FEATURED_TAGS: LandingFallbackTag[] = [
  { slug: 'fitness', href: '/channels' },
  { slug: 'meal-prep', href: '/channels' },
  { slug: 'study', href: '/channels' },
  { slug: 'productivity', href: '/channels' },
  { slug: 'skincare', href: '/channels' },
  { slug: 'mindset', href: '/channels' },
];

export const LANDING_USE_CASES: LandingUseCase[] = [
  {
    id: 'fitness',
    title: 'Fitness routines',
    description: 'Turn training videos into practical weekly plans you can follow without rewatching.',
    href: '/channels',
  },
  {
    id: 'cooking',
    title: 'Recipe systems',
    description: 'Convert long cooking videos into concise prep steps with ingredient and timing flow.',
    href: '/channels',
  },
  {
    id: 'study',
    title: 'Study guides',
    description: 'Extract clear study methods from expert videos and reuse them as repeatable blueprints.',
    href: '/channels',
  },
  {
    id: 'productivity',
    title: 'Productivity playbooks',
    description: 'Capture creator workflows into short action plans that are easy to execute each day.',
    href: '/channels',
  },
];
