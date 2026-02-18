import { describe, expect, it } from 'vitest';
import {
  getChannelResolutionMeta,
  resolveDeterministicChannelSlug,
} from '../../server/services/deterministicChannelClassifier';

describe('deterministicChannelClassifier (backend)', () => {
  it('resolves exact tagSlug match', () => {
    const slug = resolveDeterministicChannelSlug({
      tagSlugs: ['nutrition-meal-planning'],
      fallbackSlug: 'general',
    });
    expect(slug).toBe('nutrition-meal-planning');
  });

  it('resolves alias match', () => {
    const meta = getChannelResolutionMeta({
      tagSlugs: ['shake'],
      fallbackSlug: 'general',
    });
    expect(meta.resolvedSlug).toBe('nutrition-meal-planning');
    expect(meta.reason).toBe('alias_match');
  });

  it('falls back to general when no match exists', () => {
    const meta = getChannelResolutionMeta({
      tagSlugs: ['unknown-tag'],
      fallbackSlug: 'general',
    });
    expect(meta.resolvedSlug).toBe('general');
    expect(meta.reason).toBe('fallback_general');
  });
});
