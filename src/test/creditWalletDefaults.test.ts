import { describe, expect, it } from 'vitest';
import { getWalletDefaults } from '../../server/services/creditWallet';

describe('credit wallet defaults', () => {
  it('returns sane positive defaults', () => {
    const defaults = getWalletDefaults();
    expect(defaults.capacity).toBeGreaterThan(0);
    expect(defaults.refill_rate_per_sec).toBeGreaterThan(0);
    expect(defaults.initial_balance).toBeGreaterThanOrEqual(0);
    expect(defaults.initial_balance).toBeLessThanOrEqual(defaults.capacity);
  });
});
