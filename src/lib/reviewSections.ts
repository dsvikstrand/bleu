export const OVERVIEW_SECTION = 'Overview';
export const DEFAULT_REVIEW_SECTIONS = ['Overview', 'Strengths', 'Gaps', 'Suggestions'];
export const DEFAULT_ADDITIONAL_SECTIONS = DEFAULT_REVIEW_SECTIONS.filter(
  (section) => section !== OVERVIEW_SECTION
);
export const MAX_REVIEW_SECTIONS = 4;
export const MAX_ADDITIONAL_SECTIONS = MAX_REVIEW_SECTIONS - 1;

export function formatReviewSection(value: string) {
  const cleaned = value.trim().replace(/\s+/g, ' ');
  if (!cleaned) return '';
  return cleaned.replace(/\b\w/g, (char) => char.toUpperCase());
}

export function normalizeAdditionalSections(sections?: string[] | null) {
  if (!Array.isArray(sections)) return [] as string[];
  const normalized: string[] = [];
  for (const section of sections) {
    if (typeof section !== 'string') continue;
    const formatted = formatReviewSection(section);
    if (!formatted) continue;
    if (formatted.toLowerCase() === OVERVIEW_SECTION.toLowerCase()) continue;
    if (normalized.some((item) => item.toLowerCase() === formatted.toLowerCase())) continue;
    normalized.push(formatted);
  }
  return normalized;
}

export function buildReviewSections(sections?: string[] | null) {
  const additional = sections === null || sections === undefined
    ? DEFAULT_ADDITIONAL_SECTIONS
    : normalizeAdditionalSections(sections);
  return [OVERVIEW_SECTION, ...additional];
}
