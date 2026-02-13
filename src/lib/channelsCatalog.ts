export interface ChannelCatalogEntry {
  slug: string;
  name: string;
  description: string;
  status: 'active' | 'paused';
  tagSlug: string;
  isJoinEnabled: boolean;
}

export const CHANNELS_CATALOG: ChannelCatalogEntry[] = [
  {
    slug: 'fitness-training',
    name: 'Fitness Training',
    description: 'Structured exercise plans for strength, cardio, and conditioning.',
    status: 'active',
    tagSlug: 'fitness-training',
    isJoinEnabled: true,
  },
  {
    slug: 'nutrition-meal-planning',
    name: 'Nutrition and Meal Planning',
    description: 'Practical meal systems for health and consistency.',
    status: 'active',
    tagSlug: 'nutrition-meal-planning',
    isJoinEnabled: true,
  },
  {
    slug: 'sleep-recovery',
    name: 'Sleep and Recovery',
    description: 'Protocols that improve sleep quality and recovery habits.',
    status: 'active',
    tagSlug: 'sleep-recovery',
    isJoinEnabled: true,
  },
  {
    slug: 'mindfulness-mental-wellness',
    name: 'Mindfulness and Mental Wellness',
    description: 'Mental reset and stress management routines.',
    status: 'active',
    tagSlug: 'mindfulness-mental-wellness',
    isJoinEnabled: true,
  },
  {
    slug: 'skincare-personal-care',
    name: 'Skincare and Personal Care',
    description: 'Repeatable self-care routines for skin and grooming.',
    status: 'active',
    tagSlug: 'skincare-personal-care',
    isJoinEnabled: true,
  },
  {
    slug: 'cooking-home-kitchen',
    name: 'Cooking and Home Kitchen',
    description: 'Repeatable kitchen workflows and recipe systems.',
    status: 'active',
    tagSlug: 'cooking-home-kitchen',
    isJoinEnabled: true,
  },
  {
    slug: 'biohacking-supplements',
    name: 'Biohacking and Supplements',
    description: 'Habit-oriented protocols around supplements and optimization.',
    status: 'active',
    tagSlug: 'biohacking-supplements',
    isJoinEnabled: true,
  },
  {
    slug: 'productivity-systems',
    name: 'Productivity Systems',
    description: 'Planning and execution workflows for getting work done.',
    status: 'active',
    tagSlug: 'productivity-systems',
    isJoinEnabled: true,
  },
  {
    slug: 'study-learning-systems',
    name: 'Study and Learning Systems',
    description: 'Methods for learning, revision, and retention.',
    status: 'active',
    tagSlug: 'study-learning-systems',
    isJoinEnabled: true,
  },
  {
    slug: 'writing-content-creation',
    name: 'Writing and Content Creation',
    description: 'Systems for drafting, publishing, and content cadence.',
    status: 'active',
    tagSlug: 'writing-content-creation',
    isJoinEnabled: true,
  },
  {
    slug: 'creator-growth-marketing',
    name: 'Creator Growth and Marketing',
    description: 'Audience growth and distribution playbooks.',
    status: 'active',
    tagSlug: 'creator-growth-marketing',
    isJoinEnabled: true,
  },
  {
    slug: 'business-ops-freelance',
    name: 'Business Ops and Freelance',
    description: 'Lightweight operating systems for solo operators.',
    status: 'active',
    tagSlug: 'business-ops-freelance',
    isJoinEnabled: true,
  },
  {
    slug: 'career-job-search',
    name: 'Career and Job Search',
    description: 'Structured workflows for finding and landing roles.',
    status: 'active',
    tagSlug: 'career-job-search',
    isJoinEnabled: true,
  },
  {
    slug: 'personal-finance-budgeting',
    name: 'Personal Finance and Budgeting',
    description: 'Everyday money management routines and templates.',
    status: 'active',
    tagSlug: 'personal-finance-budgeting',
    isJoinEnabled: true,
  },
  {
    slug: 'investing-basics',
    name: 'Investing Basics',
    description: 'Intro-level investing routines and frameworks.',
    status: 'active',
    tagSlug: 'investing-basics',
    isJoinEnabled: true,
  },
  {
    slug: 'home-organization-cleaning',
    name: 'Home Organization and Cleaning',
    description: 'Systems for maintaining spaces with low friction.',
    status: 'active',
    tagSlug: 'home-organization-cleaning',
    isJoinEnabled: true,
  },
  {
    slug: 'parenting-family-routines',
    name: 'Parenting and Family Routines',
    description: 'Family-oriented routines for daily coordination.',
    status: 'active',
    tagSlug: 'parenting-family-routines',
    isJoinEnabled: true,
  },
  {
    slug: 'travel-planning',
    name: 'Travel Planning',
    description: 'Repeatable travel prep and trip-execution workflows.',
    status: 'active',
    tagSlug: 'travel-planning',
    isJoinEnabled: true,
  },
  {
    slug: 'developer-workflows',
    name: 'Developer Workflows',
    description: 'Coding productivity and engineering workflow routines.',
    status: 'active',
    tagSlug: 'developer-workflows',
    isJoinEnabled: true,
  },
  {
    slug: 'ai-tools-automation',
    name: 'AI Tools and Automation',
    description: 'Practical usage patterns for AI tools and automations.',
    status: 'active',
    tagSlug: 'ai-tools-automation',
    isJoinEnabled: true,
  },
];

export function getChannelBySlug(slug: string) {
  return CHANNELS_CATALOG.find((channel) => channel.slug === slug) || null;
}

export function isCuratedChannelSlug(slug: string) {
  return CHANNELS_CATALOG.some((channel) => channel.slug === slug);
}

export function resolveChannelTagSlug(slug: string) {
  const channel = getChannelBySlug(slug);
  return channel?.tagSlug || null;
}
