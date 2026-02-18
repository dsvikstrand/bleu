import {
  getFailureTransition,
  partitionByBannerCap,
  selectDeterministicDefaultBanner,
  toStableIndex,
} from '../../server/services/autoBannerPolicy';

describe('autoBannerPolicy', () => {
  it('selects deterministic default banner by key', () => {
    const urls = ['a.png', 'b.png', 'c.png'];
    const one = selectDeterministicDefaultBanner({
      channelSlug: 'nutrition',
      blueprintId: 'bp-1',
      bannerUrls: urls,
    });
    const two = selectDeterministicDefaultBanner({
      channelSlug: 'nutrition',
      blueprintId: 'bp-1',
      bannerUrls: urls,
    });

    expect(one).toBe(two);
    expect(urls.includes(String(one))).toBe(true);
    expect(toStableIndex('nutrition:bp-1', urls.length)).toBeGreaterThanOrEqual(0);
  });

  it('partitions keep/demote by newest created_at first', () => {
    const rows = [
      { id: '1', created_at: '2026-02-18T10:00:00.000Z' },
      { id: '2', created_at: '2026-02-18T11:00:00.000Z' },
      { id: '3', created_at: '2026-02-18T09:00:00.000Z' },
    ];

    const { keep, demote } = partitionByBannerCap(rows, 2);
    expect(keep.map((row) => row.id)).toEqual(['2', '1']);
    expect(demote.map((row) => row.id)).toEqual(['3']);
  });

  it('moves job to dead when attempts reach max, otherwise failed with backoff', () => {
    const now = new Date('2026-02-18T12:00:00.000Z');
    const failed = getFailureTransition({ attempts: 1, maxAttempts: 3, now });
    expect(failed.status).toBe('failed');
    expect(failed.availableAt).toBe('2026-02-18T12:01:00.000Z');

    const dead = getFailureTransition({ attempts: 3, maxAttempts: 3, now });
    expect(dead.status).toBe('dead');
    expect(dead.availableAt).toBeNull();
  });
});
