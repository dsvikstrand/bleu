import { type PersonaV0 } from './persona_v0';

export type PromptPackV0RunType = 'seed' | 'library' | 'blueprint';

export type PromptPackV0Library = {
  topic: string;
  title: string;
  description: string;
  notes: string;
  tags: string[];
};

export type PromptPackV0Blueprint = {
  title: string;
  description: string;
  notes: string;
  tags: string[];
};

export type PromptPackV0 = {
  version: 0;
  run_type: PromptPackV0RunType;
  goal: string;
  persona_id?: string;
  library: PromptPackV0Library;
  blueprints: PromptPackV0Blueprint[];
  review_focus?: string;
  banner_prompt?: string;
};

function normalizeSlug(input: string) {
  return String(input || '')
    .trim()
    .replace(/^#/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function uniq(list: string[]) {
  return Array.from(new Set(list.map((s) => String(s || '').trim()).filter(Boolean)));
}

function toTitleCase(input: string) {
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

function inferDomain(p: PersonaV0 | null, goal: string) {
  const t = `${(p?.safety?.domain || '').toLowerCase()} ${(p?.interests?.topics || []).join(' ').toLowerCase()} ${String(
    goal || ''
  ).toLowerCase()}`;
  if (t.includes('skincare')) return 'skincare';
  if (t.includes('fitness') || t.includes('workout') || t.includes('strength')) return 'fitness';
  if (t.includes('productivity') || t.includes('planning') || t.includes('focus')) return 'productivity';
  return 'general';
}

function buildLibrary(goal: string, p: PersonaV0 | null): PromptPackV0Library {
  const domain = inferDomain(p, goal);
  const baseTitle = toTitleCase(goal).slice(0, 60).trim() || 'Seed Library';
  const title = baseTitle.toLowerCase().endsWith('library') ? baseTitle : `${baseTitle} Library`;

  const prefer = (p?.interests?.tags_prefer || []).map(normalizeSlug);
  const topics = (p?.interests?.topics || []).map(normalizeSlug);
  const tags = uniq([...prefer, ...topics]).filter(Boolean).slice(0, 8);

  const mustInclude = (p?.constraints?.must_include || []).map(String).filter(Boolean);
  const mustAvoid = (p?.constraints?.must_avoid || []).map(String).filter(Boolean);

  const notesParts: string[] = [];
  notesParts.push(`Goal: ${goal}`);
  if (domain === 'skincare') notesParts.push('Keep it gentle and beginner friendly. Avoid medical claims.');
  if (domain === 'fitness') notesParts.push('Prioritize safe form cues and realistic progression. Avoid maxing out advice.');
  if (domain === 'productivity') notesParts.push('Keep it low-friction, repeatable, and clear. Avoid extreme schedules.');
  if (mustInclude.length) notesParts.push(`Must include: ${mustInclude.join('; ')}`);
  if (mustAvoid.length) notesParts.push(`Avoid: ${mustAvoid.join('; ')}`);

  return {
    topic: goal,
    title,
    description: `A practical library of items to support: ${goal}.`,
    notes: notesParts.join(' '),
    tags,
  };
}

function buildBlueprintTemplates(domain: string): PromptPackV0Blueprint[] {
  if (domain === 'skincare') {
    return [
      {
        title: '10-Min Skincare Starter',
        description: 'A simple AM and PM routine that fits a busy schedule.',
        notes: 'Prefer fragrance-free options. Keep steps short and safe.',
        tags: ['skincare', 'beginner', 'routine'],
      },
      {
        title: 'Gentle Hydration Focus',
        description: 'A gentle routine focused on barrier support and hydration.',
        notes: 'Avoid strong actives until basics feel stable.',
        tags: ['hydration', 'sensitive-skin'],
      },
      {
        title: 'Weekly Reset Add-ons',
        description: 'Optional weekly steps you can add when you have time.',
        notes: 'Keep it conservative and skip anything irritating.',
        tags: ['self-care', 'weekly'],
      },
    ];
  }
  if (domain === 'fitness') {
    return [
      {
        title: 'Strength Basics (Full Body)',
        description: 'A safe, structured full-body routine built around compound movements.',
        notes: 'Focus on form cues and simple progression week to week.',
        tags: ['strength-training', 'compound-lifts'],
      },
      {
        title: 'Hypertrophy Focus (Simple Split)',
        description: 'A simple split that emphasizes volume and recovery.',
        notes: 'Pick a few key lifts and track small improvements.',
        tags: ['hypertrophy', 'progressive-overload'],
      },
      {
        title: 'Mobility and Recovery Day',
        description: 'A recovery-focused routine to support consistency.',
        notes: 'Keep intensity low and prioritize range of motion.',
        tags: ['mobility', 'recovery'],
      },
    ];
  }
  if (domain === 'productivity') {
    return [
      {
        title: 'Morning Focus Block',
        description: 'A short routine to start the day with clarity and momentum.',
        notes: 'Use simple defaults. Keep it under 20 minutes.',
        tags: ['productivity', 'morning', 'focus'],
      },
      {
        title: 'Daily Planning (5-Min)',
        description: 'A quick planning routine to reduce decision fatigue.',
        notes: 'Pick 1-3 priorities and schedule them.',
        tags: ['planning', 'time-blocking'],
      },
      {
        title: 'Deep Work Sprint',
        description: 'A routine designed for a focused work session.',
        notes: 'Remove distractions and define a clear done condition.',
        tags: ['deep-work', 'focus'],
      },
    ];
  }

  return [
    {
      title: 'Quick Starter',
      description: 'A short routine to get started and build consistency.',
      notes: 'Keep it practical and repeatable.',
      tags: ['starter', 'routine'],
    },
    {
      title: 'Consistency Plan',
      description: 'A routine designed to be repeated reliably.',
      notes: 'Prefer simple defaults and low friction.',
      tags: ['consistency'],
    },
    {
      title: 'Weekend Reset',
      description: 'Optional steps you can do when you have extra time.',
      notes: 'Keep it conservative and safe.',
      tags: ['weekly'],
    },
  ];
}

export function composePromptPackV0(opts: {
  runType: PromptPackV0RunType;
  goal: string;
  persona: PersonaV0 | null;
  blueprintCount: number;
  templateOffset?: number;
}): PromptPackV0 {
  const goal = String(opts.goal || '').trim();
  if (!goal) throw new Error('composePromptPackV0: missing goal');
  const runType = opts.runType;
  const p = opts.persona;
  const domain = inferDomain(p, goal);

  const library = buildLibrary(goal, p);
  const templates = buildBlueprintTemplates(domain);
  const n = Math.max(0, Number(opts.blueprintCount || 0) || 0);
  const count = Math.max(1, n);
  const offset = Math.max(0, Number(opts.templateOffset || 0) || 0);

  const blueprints: PromptPackV0Blueprint[] = Array.from({ length: count }).map((_, i) => {
    const t = templates[(offset + i) % templates.length]!;
    return {
      title: t.title,
      description: t.description,
      notes: t.notes,
      tags: uniq([...(library.tags || []), ...(t.tags || [])]).filter(Boolean).slice(0, 10),
    };
  });

  return {
    version: 0,
    run_type: runType,
    goal,
    ...(p ? { persona_id: p.id } : {}),
    library,
    blueprints,
  };
}

