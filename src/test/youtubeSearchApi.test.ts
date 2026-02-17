import {
  clampSearchLimit,
  normalizeYouTubeSearchResult,
  validateSearchQuery,
} from '@/lib/youtubeSearchApi';

describe('youtubeSearchApi utils', () => {
  it('clamps limit in 1..25 range with default 10', () => {
    expect(clampSearchLimit()).toBe(10);
    expect(clampSearchLimit(0)).toBe(1);
    expect(clampSearchLimit(1)).toBe(1);
    expect(clampSearchLimit(10)).toBe(10);
    expect(clampSearchLimit(99)).toBe(25);
  });

  it('validates search query length', () => {
    const invalid = validateSearchQuery(' a ');
    expect(invalid.ok).toBe(false);

    const valid = validateSearchQuery('  skincare 2026 best ');
    expect(valid.ok).toBe(true);
    if (valid.ok) {
      expect(valid.query).toBe('skincare 2026 best');
    }
  });

  it('normalizes search results with fallback urls', () => {
    const normalized = normalizeYouTubeSearchResult({
      video_id: 'abc123xyz89',
      channel_id: 'UC12345678901234567890',
      title: 'Test title',
      description: 'Test description',
      channel_title: 'Channel Name',
      thumbnail_url: null,
      published_at: '2026-02-17T10:00:00Z',
    });

    expect(normalized).not.toBeNull();
    expect(normalized?.video_url).toBe('https://www.youtube.com/watch?v=abc123xyz89');
    expect(normalized?.channel_url).toBe('https://www.youtube.com/channel/UC12345678901234567890');
  });
});

