import {
  SUBSCRIPTION_HEALTHY_WINDOW_MINUTES,
  evaluateSubscriptionHealth,
  summarizeSubscriptionHealth,
} from '@/lib/subscriptionHealth';

describe('subscriptionHealth', () => {
  const now = new Date('2026-02-17T12:00:00.000Z').getTime();

  it('maps never-polled and error states', () => {
    const waiting = evaluateSubscriptionHealth({ last_polled_at: null, last_sync_error: null }, now);
    expect(waiting.state).toBe('never_polled');

    const error = evaluateSubscriptionHealth({ last_polled_at: null, last_sync_error: 'SYNC_FAILED' }, now);
    expect(error.state).toBe('error');
  });

  it('respects healthy/delayed boundary at 60 minutes', () => {
    const plus59 = new Date(now - 59 * 60_000).toISOString();
    const plus60 = new Date(now - 60 * 60_000).toISOString();
    const plus61 = new Date(now - 61 * 60_000).toISOString();

    expect(evaluateSubscriptionHealth({ last_polled_at: plus59, last_sync_error: null }, now).state).toBe('healthy');
    expect(evaluateSubscriptionHealth({ last_polled_at: plus60, last_sync_error: null }, now).state).toBe('healthy');
    expect(evaluateSubscriptionHealth({ last_polled_at: plus61, last_sync_error: null }, now).state).toBe('delayed');
  });

  it('summarizes counts and delayed ratio', () => {
    const summary = summarizeSubscriptionHealth([
      { last_polled_at: new Date(now - 30 * 60_000).toISOString(), last_sync_error: null },
      { last_polled_at: new Date(now - 120 * 60_000).toISOString(), last_sync_error: null },
      { last_polled_at: null, last_sync_error: 'WRITE_FAILED' },
      { last_polled_at: null, last_sync_error: null },
    ], now, SUBSCRIPTION_HEALTHY_WINDOW_MINUTES);

    expect(summary.total).toBe(4);
    expect(summary.healthy).toBe(1);
    expect(summary.delayed).toBe(1);
    expect(summary.error).toBe(1);
    expect(summary.neverPolled).toBe(1);
    expect(summary.delayedRatio).toBe(0.25);
    expect(summary.lastSuccessfulPollAt).toBe(new Date(now - 30 * 60_000).toISOString());
  });
});

