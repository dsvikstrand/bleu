// StackLab Data Types
// Designed for LocalStorage V1, ready for Supabase migration

export type SupplementCategory = 
  | 'sleep-recovery'
  | 'amino-performance'
  | 'nootropics-focus'
  | 'energy-stimulants'
  | 'stress-mood'
  | 'foundations';

export interface InventoryItem {
  id: string;
  name: string;
  category: SupplementCategory;
  isCustom: boolean;
}

export type DoseStrength = 'low' | 'medium' | 'high';
export type FrequencyUnit = 'day' | 'week';
export type CaffeineTolerance = 'none' | 'low' | 'medium' | 'high';
export type SleepSensitivity = 'low' | 'medium' | 'high';

export interface SafetyFlags {
  takesMedications: boolean;
  caffeineTolerance: CaffeineTolerance;
  sleepSensitivity: SleepSensitivity;
  pregnantOrBreastfeeding: boolean;
  bloodPressureConcerns: boolean;
  anxietySensitivity: boolean;
}

export interface Settings {
  doseStrength: DoseStrength;
  frequencyN: number;
  frequencyUnit: FrequencyUnit;
  safetyFlags: SafetyFlags;
}

export interface Goal {
  id: string;
  label: string;
  isCustom: boolean;
}

export interface Recommendation {
  id: string;
  rawMarkdown: string;
  createdAt: string;
  inputsSnapshot: {
    inventory: InventoryItem[];
    goals: Goal[];
    settings: Settings;
  };
}

export interface StackLabState {
  inventory: InventoryItem[];
  selectedGoals: Goal[];
  customGoals: Goal[];
  settings: Settings;
  recommendations: Recommendation[];
}

// Preset Goals
export const PRESET_GOALS: Omit<Goal, 'isCustom'>[] = [
  { id: 'sleep-quality', label: 'Sleep quality' },
  { id: 'fall-asleep-faster', label: 'Fall asleep faster' },
  { id: 'reduce-night-awakenings', label: 'Reduce night awakenings' },
  { id: 'morning-energy', label: 'Morning energy' },
  { id: 'calm-anxiety-reduction', label: 'Calm / anxiety reduction' },
  { id: 'focus', label: 'Focus' },
  { id: 'mental-clarity', label: 'Mental clarity' },
  { id: 'mood', label: 'Mood' },
  { id: 'workout-performance', label: 'Workout performance' },
  { id: 'endurance', label: 'Endurance' },
  { id: 'muscle-recovery', label: 'Muscle recovery' },
];

// Supplement Catalog
export const SUPPLEMENT_CATALOG: Record<SupplementCategory, Omit<InventoryItem, 'isCustom'>[]> = {
  'sleep-recovery': [
    { id: 'magnesium-glycinate', name: 'Magnesium glycinate', category: 'sleep-recovery' },
    { id: 'glycine', name: 'Glycine', category: 'sleep-recovery' },
    { id: 'l-theanine-sleep', name: 'L-theanine', category: 'sleep-recovery' },
    { id: 'apigenin', name: 'Apigenin', category: 'sleep-recovery' },
    { id: 'melatonin', name: 'Melatonin', category: 'sleep-recovery' },
    { id: 'taurine', name: 'Taurine', category: 'sleep-recovery' },
    { id: 'ashwagandha-sleep', name: 'Ashwagandha', category: 'sleep-recovery' },
    { id: 'chamomile-extract', name: 'Chamomile extract', category: 'sleep-recovery' },
    { id: 'gaba', name: 'GABA', category: 'sleep-recovery' },
    { id: 'l-tryptophan', name: 'L-tryptophan', category: 'sleep-recovery' },
  ],
  'amino-performance': [
    { id: 'creatine-monohydrate', name: 'Creatine monohydrate', category: 'amino-performance' },
    { id: 'beta-alanine', name: 'Beta-alanine', category: 'amino-performance' },
    { id: 'citrulline-malate', name: 'Citrulline malate', category: 'amino-performance' },
    { id: 'l-tyrosine', name: 'L-tyrosine', category: 'amino-performance' },
    { id: 'bcaas', name: 'BCAAs', category: 'amino-performance' },
    { id: 'eaas', name: 'EAAs', category: 'amino-performance' },
    { id: 'l-carnitine', name: 'L-carnitine', category: 'amino-performance' },
    { id: 'sodium-bicarbonate', name: 'Sodium bicarbonate', category: 'amino-performance' },
  ],
  'nootropics-focus': [
    { id: 'lions-mane', name: "Lion's mane", category: 'nootropics-focus' },
    { id: 'rhodiola-rosea', name: 'Rhodiola rosea', category: 'nootropics-focus' },
    { id: 'bacopa-monnieri', name: 'Bacopa monnieri', category: 'nootropics-focus' },
    { id: 'alpha-gpc', name: 'Alpha-GPC', category: 'nootropics-focus' },
    { id: 'cdp-choline', name: 'CDP-choline', category: 'nootropics-focus' },
    { id: 'panax-ginseng', name: 'Panax ginseng', category: 'nootropics-focus' },
    { id: 'ginkgo-biloba', name: 'Ginkgo biloba', category: 'nootropics-focus' },
  ],
  'energy-stimulants': [
    { id: 'caffeine', name: 'Caffeine', category: 'energy-stimulants' },
    { id: 'l-theanine-energy', name: 'L-theanine', category: 'energy-stimulants' },
    { id: 'green-tea-extract', name: 'Green tea extract', category: 'energy-stimulants' },
    { id: 'yerba-mate', name: 'Yerba mate', category: 'energy-stimulants' },
    { id: 'cordyceps', name: 'Cordyceps', category: 'energy-stimulants' },
    { id: 'b-vitamins', name: 'B vitamins (complex)', category: 'energy-stimulants' },
    { id: 'coq10', name: 'CoQ10', category: 'energy-stimulants' },
    { id: 'alcar', name: 'Acetyl-L-carnitine (ALCAR)', category: 'energy-stimulants' },
  ],
  'stress-mood': [
    { id: 'ashwagandha-stress', name: 'Ashwagandha', category: 'stress-mood' },
    { id: 'l-theanine-stress', name: 'L-theanine', category: 'stress-mood' },
    { id: 'magnesium-stress', name: 'Magnesium', category: 'stress-mood' },
    { id: 'saffron-extract', name: 'Saffron extract', category: 'stress-mood' },
    { id: 'omega-3-mood', name: 'Omega-3 (EPA/DHA)', category: 'stress-mood' },
    { id: 'vitamin-d3-mood', name: 'Vitamin D3', category: 'stress-mood' },
    { id: 'inositol', name: 'Inositol', category: 'stress-mood' },
    { id: 'lemon-balm', name: 'Lemon balm', category: 'stress-mood' },
  ],
  'foundations': [
    { id: 'omega-3', name: 'Omega-3 (EPA/DHA)', category: 'foundations' },
    { id: 'vitamin-d3', name: 'Vitamin D3', category: 'foundations' },
    { id: 'vitamin-k2', name: 'Vitamin K2', category: 'foundations' },
    { id: 'multivitamin', name: 'Multivitamin', category: 'foundations' },
    { id: 'electrolytes', name: 'Electrolytes', category: 'foundations' },
    { id: 'fiber-psyllium', name: 'Fiber (psyllium)', category: 'foundations' },
    { id: 'probiotic', name: 'Probiotic', category: 'foundations' },
    { id: 'zinc', name: 'Zinc', category: 'foundations' },
  ],
};

export const CATEGORY_LABELS: Record<SupplementCategory, string> = {
  'sleep-recovery': 'Sleep & Recovery',
  'amino-performance': 'Aminos & Performance',
  'nootropics-focus': 'Nootropics & Focus',
  'energy-stimulants': 'Energy & Stimulants',
  'stress-mood': 'Stress & Mood',
  'foundations': 'Foundations',
};

export const DEFAULT_SETTINGS: Settings = {
  doseStrength: 'medium',
  frequencyN: 3,
  frequencyUnit: 'day',
  safetyFlags: {
    takesMedications: false,
    caffeineTolerance: 'medium',
    sleepSensitivity: 'medium',
    pregnantOrBreastfeeding: false,
    bloodPressureConcerns: false,
    anxietySensitivity: false,
  },
};

export const DEFAULT_STATE: StackLabState = {
  inventory: [],
  selectedGoals: [],
  customGoals: [],
  settings: DEFAULT_SETTINGS,
  recommendations: [],
};
