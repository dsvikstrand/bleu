export const VISIBLE_CHIPS_COUNT = 4;

const MARKDOWN_HEADING_RE = /^\s{0,3}#{1,6}\s+/;
const MARKDOWN_BULLET_RE = /^\s*(?:[-*+]\s+|\d+\.\s+|\d+\)\s+)/;

function stripLineMarkdown(line: string): string {
  return line
    .replace(MARKDOWN_HEADING_RE, "")
    .replace(MARKDOWN_BULLET_RE, "")
    .replace(/\*\*/g, "")
    .replace(/__/g, "")
    .replace(/`/g, "")
    .trim();
}

export function cleanFeedPreview(raw: string): string {
  if (!raw) return "";
  const lines = raw.split("\n").map((line) => stripLineMarkdown(line));
  const compact = lines.filter(Boolean).join(" ");
  return compact.replace(/\s+/g, " ").trim();
}

interface BuildFeedSummaryOptions {
  primary?: string | null;
  secondary?: string | null;
  fallback: string;
  maxChars?: number;
}

export function buildFeedSummary({
  primary,
  secondary,
  fallback,
  maxChars = 240,
}: BuildFeedSummaryOptions): string {
  const source = cleanFeedPreview(primary || "") || cleanFeedPreview(secondary || "") || fallback;
  const text = source.trim();
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars).trim()}...`;
}
