import { CHANNELS_CATALOG, type ChannelCatalogEntry } from '../../src/lib/channelsCatalog';
import { normalizeTag } from '../../src/lib/tagging';

export type ChannelClassifierReason = 'tag_match' | 'alias_match' | 'fallback_general';

export type DeterministicChannelResolutionMeta = {
  resolvedSlug: string;
  fallbackSlug: string;
  reason: ChannelClassifierReason;
  matchedTagSlug: string | null;
};

function normalizeTagSlug(input: string): string {
  return normalizeTag(String(input || '').replace(/^#/, ''));
}

function getFallbackSlug(
  fallbackSlug: string | undefined,
  catalog: ChannelCatalogEntry[] = CHANNELS_CATALOG,
): string {
  const normalized = normalizeTagSlug(fallbackSlug || '');
  if (normalized && catalog.some((channel) => channel.slug === normalized)) return normalized;
  return catalog.find((channel) => channel.slug === 'general')?.slug || 'general';
}

export function getChannelResolutionMeta(input: {
  tagSlugs: string[];
  fallbackSlug?: string;
  catalog?: ChannelCatalogEntry[];
}): DeterministicChannelResolutionMeta {
  const catalog = input.catalog || CHANNELS_CATALOG;
  const fallback = getFallbackSlug(input.fallbackSlug, catalog);
  const normalizedTags = Array.from(
    new Set((input.tagSlugs || []).map((tag) => normalizeTagSlug(tag)).filter(Boolean)),
  );

  type Match = {
    slug: string;
    priority: number;
    matchKind: 'tag' | 'alias';
    tag: string;
  };

  const matches: Match[] = [];
  for (const channel of catalog) {
    if (channel.slug === fallback) continue;
    for (const tag of normalizedTags) {
      if (tag === channel.tagSlug) {
        matches.push({
          slug: channel.slug,
          priority: channel.priority,
          matchKind: 'tag',
          tag,
        });
      } else if (channel.aliases.includes(tag)) {
        matches.push({
          slug: channel.slug,
          priority: channel.priority,
          matchKind: 'alias',
          tag,
        });
      }
    }
  }

  if (matches.length === 0) {
    return {
      resolvedSlug: fallback,
      fallbackSlug: fallback,
      reason: 'fallback_general',
      matchedTagSlug: null,
    };
  }

  matches.sort((a, b) => {
    if (a.matchKind !== b.matchKind) return a.matchKind === 'tag' ? -1 : 1;
    if (a.priority !== b.priority) return a.priority - b.priority;
    return a.slug.localeCompare(b.slug);
  });

  const top = matches[0];
  return {
    resolvedSlug: top.slug,
    fallbackSlug: fallback,
    reason: top.matchKind === 'tag' ? 'tag_match' : 'alias_match',
    matchedTagSlug: top.tag,
  };
}

export function resolveDeterministicChannelSlug(input: {
  tagSlugs: string[];
  fallbackSlug?: string;
  catalog?: ChannelCatalogEntry[];
}): string {
  return getChannelResolutionMeta(input).resolvedSlug;
}
