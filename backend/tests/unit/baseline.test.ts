import { describe, it, expect } from 'vitest';
import { computeOriginalOrderBaseline, computeNearestNeighborBaseline } from '../../src/services/baseline.service';

// 0 = depot, 1/2/3 = stops. Symmetric matrix in seconds / meters.
const durationsSec = [
  [0, 10, 100, 20],
  [10, 0, 90, 15],
  [100, 90, 0, 95],
  [20, 15, 95, 0],
];
const distancesMeters = durationsSec.map((row) => row.map((v) => v * 10));

describe('computeOriginalOrderBaseline', () => {
  it('visits stops in the exact order given, starting and ending at depot', () => {
    const result = computeOriginalOrderBaseline(3, durationsSec, distancesMeters);
    expect(result.sequence).toEqual([0, 1, 2, 3, 0]);
  });

  it('sums leg durations/distances correctly', () => {
    const result = computeOriginalOrderBaseline(3, durationsSec, distancesMeters);
    const expectedDuration = 10 + 90 + 95 + 20; // 0->1->2->3->0
    expect(result.totalDurationSec).toBe(expectedDuration);
    expect(result.totalDistanceMeters).toBe(expectedDuration * 10);
  });
});

describe('computeNearestNeighborBaseline', () => {
  it('always greedily picks the closest unvisited stop', () => {
    const result = computeNearestNeighborBaseline(3, durationsSec, distancesMeters);
    // From depot(0): nearest is 1 (10). From 1: nearest unvisited is 3 (15). From 3: only 2 left (95).
    expect(result.sequence).toEqual([0, 1, 3, 2, 0]);
  });

  it('never revisits a stop', () => {
    const result = computeNearestNeighborBaseline(3, durationsSec, distancesMeters);
    const stopsOnly = result.sequence.slice(1, -1);
    expect(new Set(stopsOnly).size).toBe(stopsOnly.length);
  });
});
