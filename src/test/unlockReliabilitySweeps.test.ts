import { beforeEach, describe, expect, it, vi } from 'vitest';
import { runUnlockReliabilitySweeps, resetUnlockSweepRuntimeStateForTests } from '../../server/services/unlockReliabilitySweeps';
import type { SourceItemUnlockRow } from '../../server/services/sourceUnlocks';

function buildUnlock(overrides: Partial<SourceItemUnlockRow>): SourceItemUnlockRow {
  return {
    id: 'unlock_1',
    source_item_id: 'source_1',
    source_page_id: 'page_1',
    status: 'reserved',
    estimated_cost: 1,
    reserved_by_user_id: 'user_1',
    reservation_expires_at: new Date(Date.now() - 60_000).toISOString(),
    reserved_ledger_id: 'ledger_1',
    blueprint_id: null,
    job_id: null,
    last_error_code: null,
    last_error_message: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

describe('unlock reliability sweeps', () => {
  beforeEach(() => {
    resetUnlockSweepRuntimeStateForTests();
  });

  it('recovers expired reserved unlocks with single refund + fail transition', async () => {
    const refundReservation = vi.fn(async () => ({ bypass: false, ledger_id: 'refund_1', wallet: null }));
    const failUnlock = vi.fn(async () => buildUnlock({ status: 'available', reserved_by_user_id: null, reserved_ledger_id: null }));

    const result = await runUnlockReliabilitySweeps(
      {} as any,
      {
        force: true,
        batchSize: 50,
        dryLogs: false,
      },
      {
        now: () => new Date('2026-02-20T10:00:00.000Z'),
        findExpiredReservedUnlocks: vi.fn(async () => [buildUnlock({ id: 'unlock_expired_1' })]),
        failUnlock,
        refundReservation,
        listProcessingUnlocks: vi.fn(async () => []),
        getJobsByIds: vi.fn(async () => new Map()),
        listRunningUnlockJobs: vi.fn(async () => []),
        countActiveUnlockLinksForJobs: vi.fn(async () => new Map()),
        markJobsFailed: vi.fn(async () => 0),
      },
    );

    expect(result.skipped).toBe(false);
    expect(result.expired_recovered).toBe(1);
    expect(refundReservation).toHaveBeenCalledTimes(1);
    expect(failUnlock).toHaveBeenCalledTimes(1);
  });

  it('recovers stale processing unlock when linked job is missing/terminal', async () => {
    const processingUnlock = buildUnlock({
      id: 'unlock_processing_1',
      status: 'processing',
      reservation_expires_at: new Date(Date.now() + 60_000).toISOString(),
      job_id: 'job_1',
      updated_at: '2026-02-20T09:40:00.000Z',
    });

    const refundReservation = vi.fn(async () => ({ bypass: false, ledger_id: 'refund_1', wallet: null }));
    const failUnlock = vi.fn(async () => buildUnlock({ status: 'available' }));

    const result = await runUnlockReliabilitySweeps(
      {} as any,
      {
        force: true,
        dryLogs: false,
        processingStaleMs: 10 * 60_000,
      },
      {
        now: () => new Date('2026-02-20T10:00:00.000Z'),
        findExpiredReservedUnlocks: vi.fn(async () => []),
        failUnlock,
        refundReservation,
        listProcessingUnlocks: vi.fn(async () => [processingUnlock]),
        getJobsByIds: vi.fn(async () => new Map([['job_1', {
          id: 'job_1',
          status: 'failed',
          scope: 'source_item_unlock_generation',
          started_at: '2026-02-20T09:30:00.000Z',
          updated_at: '2026-02-20T09:40:00.000Z',
        }]])),
        listRunningUnlockJobs: vi.fn(async () => []),
        countActiveUnlockLinksForJobs: vi.fn(async () => new Map()),
        markJobsFailed: vi.fn(async () => 0),
      },
    );

    expect(result.processing_recovered).toBe(1);
    expect(refundReservation).toHaveBeenCalledTimes(1);
    expect(failUnlock).toHaveBeenCalledTimes(1);
  });

  it('marks orphan running unlock jobs as failed', async () => {
    const markJobsFailed = vi.fn(async () => 1);
    const result = await runUnlockReliabilitySweeps(
      {} as any,
      {
        force: true,
        dryLogs: false,
      },
      {
        now: () => new Date('2026-02-20T10:00:00.000Z'),
        findExpiredReservedUnlocks: vi.fn(async () => []),
        failUnlock: vi.fn(async () => buildUnlock({ status: 'available' })),
        refundReservation: vi.fn(async () => ({ bypass: false, ledger_id: 'refund_1', wallet: null })),
        listProcessingUnlocks: vi.fn(async () => []),
        getJobsByIds: vi.fn(async () => new Map()),
        listRunningUnlockJobs: vi.fn(async () => [{
          id: 'job_orphan_1',
          status: 'running',
          scope: 'source_item_unlock_generation',
          started_at: '2026-02-20T09:00:00.000Z',
          updated_at: '2026-02-20T09:05:00.000Z',
        }]),
        countActiveUnlockLinksForJobs: vi.fn(async () => new Map()),
        markJobsFailed,
      },
    );

    expect(result.orphan_jobs_recovered).toBe(1);
    expect(markJobsFailed).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        jobIds: ['job_orphan_1'],
        errorCode: 'ORPHAN_UNLOCK_JOB_RECOVERED',
      }),
    );
  });
});

