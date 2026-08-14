import { describe, it, expect } from 'vitest';
import { percentImprovement } from '../../src/services/route-optimization.service';

describe('percentImprovement', () => {
  it('computes a positive percent when optimized beats baseline', () => {
    expect(percentImprovement(100, 68)).toBe(32);
  });

  it('returns 0 when baseline is 0 (avoids divide-by-zero)', () => {
    expect(percentImprovement(0, 0)).toBe(0);
  });

  it('returns a negative percent if optimized is somehow worse', () => {
    expect(percentImprovement(50, 60)).toBe(-20);
  });
});
