import {
  clampChannelSearchLimit,
  normalizeYouTubeChannelSearchResult,
  validateChannelSearchQuery,
} from '@/lib/youtubeChannelSearchApi';

describe('youtubeChannelSearchApi utils', () => {
  it('clamps limit in 1..25 range with default 10', () => {
    expect(clampChannelSearchLimit()).toBe(10);
    expect(clampChannelSearchLimit(0)).toBe(1);
    expect(clampChannelSearchLimit(1)).toBe(1);
    expect(clampChannelSearchLimit(10)).toBe(10);
    expect(clampChannelSearchLimit(99)).toBe(25);
  });

  it('validates search query length', () => {
    const invalid = validateChannelSearchQuery(' a ');
    expect(invalid.ok).toBe(false);

    const valid = validateChannelSearchQuery('  skincare routines ');
    expect(valid.ok).toBe(true);
    if (valid.ok) {
      expect(valid.query).toBe('skincare routines');
    }
  });

  it('normalizes channel results with fallback url', () => {
    const normalized = normalizeYouTubeChannelSearchResult({
      channel_id: 'UC12345678901234567890',
      channel_title: 'Skincare Lab',
      description: 'Tips and routines',
      thumbnail_url: null,
      published_at: '2026-02-17T10:00:00Z',
    });

    expect(normalized).not.toBeNull();
    expect(normalized?.channel_url).toBe('https://www.youtube.com/channel/UC12345678901234567890');
  });
});
