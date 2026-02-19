import { describe, expect, it } from 'vitest';
import { computeUnlockCost } from '../../server/services/sourceUnlocks';

describe('source unlock pricing', () => {
  it('charges 1.000 for single subscriber', () => {
    expect(computeUnlockCost(1)).toBe(1);
  });

  it('rounds inverse cost to 3 decimals', () => {
    expect(computeUnlockCost(3)).toBe(0.333);
  });

  it('respects minimum floor', () => {
    expect(computeUnlockCost(1000)).toBe(0.05);
  });
});
