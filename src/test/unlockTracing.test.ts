import { describe, expect, it, vi } from 'vitest';
import { buildUnlockTraceContext, createUnlockTraceId, logUnlockEvent } from '../../server/services/unlockTrace';

describe('unlock tracing utilities', () => {
  it('creates unique trace ids with unlock prefix', () => {
    const first = createUnlockTraceId();
    const second = createUnlockTraceId();
    expect(first.startsWith('ut_')).toBe(true);
    expect(second.startsWith('ut_')).toBe(true);
    expect(first).not.toBe(second);
  });

  it('builds clean trace payloads without empty fields', () => {
    const payload = buildUnlockTraceContext(
      {
        trace_id: 'ut_test',
        user_id: 'user_1',
        source_item_id: '',
        source_page_id: null,
      },
      {
        job_id: 'job_1',
        note: 'ok',
        empty: '',
      },
    );

    expect(payload).toEqual({
      trace_id: 'ut_test',
      user_id: 'user_1',
      job_id: 'job_1',
      note: 'ok',
    });
  });

  it('logs structured unlock events', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    logUnlockEvent(
      'unlock_item_succeeded',
      { trace_id: 'ut_test', unlock_id: 'unlock_1' },
      { blueprint_id: 'bp_1' },
    );

    expect(consoleSpy).toHaveBeenCalledTimes(1);
    const [eventLabel, payload] = consoleSpy.mock.calls[0] || [];
    expect(eventLabel).toBe('[unlock_item_succeeded]');
    expect(String(payload || '')).toContain('"trace_id":"ut_test"');
    expect(String(payload || '')).toContain('"blueprint_id":"bp_1"');
    consoleSpy.mockRestore();
  });
});

