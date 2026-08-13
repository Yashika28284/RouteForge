/**
 * Computes baseline routes to compare the optimizer's result against:
 *  1. "original order" — exactly the order stops were entered/stored in
 *  2. "nearest neighbor" — a naive greedy heuristic, always visit the
 *     closest unvisited stop next
 *
 * Both are evaluated using the SAME real-road matrix as the optimizer,
 * so the comparison is apples-to-apples.
 */

export interface BaselineResult {
  sequence: number[]; // node indices, depot(0) ... depot(0)
  totalDistanceMeters: number;
  totalDurationSec: number;
}

function evaluateSequence(
  sequence: number[],
  durationsSec: number[][],
  distancesMeters: number[][],
  serviceTimesSec: number[] = []
): BaselineResult {
  let totalDistanceMeters = 0;
  let totalDurationSec = 0;
  for (let i = 0; i < sequence.length - 1; i++) {
    const from = sequence[i];
    const to = sequence[i + 1];
    totalDistanceMeters += distancesMeters[from][to];
    totalDurationSec += durationsSec[from][to];
    // Match the solver's convention: service time at the node being
    // departed is added to cumulative duration (see optimize-service
    // tsp_solver.py, which does the same). The depot (index 0) has no
    // service time. Without this, "optimized" duration (which includes
    // service time) is never comparable to baseline duration (which
    // didn't), making the reported time improvement % meaningless.
    totalDurationSec += serviceTimesSec[from] ?? 0;
  }
  return { sequence, totalDistanceMeters, totalDurationSec };
}

/** Node 0 is always the depot; nodes 1..n are stops in original input order. */
export function computeOriginalOrderBaseline(
  numStops: number,
  durationsSec: number[][],
  distancesMeters: number[][],
  serviceTimesSec: number[] = []
): BaselineResult {
  const sequence = [0, ...Array.from({ length: numStops }, (_, i) => i + 1), 0];
  return evaluateSequence(sequence, durationsSec, distancesMeters, serviceTimesSec);
}

export function computeNearestNeighborBaseline(
  numStops: number,
  durationsSec: number[][],
  distancesMeters: number[][],
  serviceTimesSec: number[] = []
): BaselineResult {
  const unvisited = new Set(Array.from({ length: numStops }, (_, i) => i + 1));
  const sequence: number[] = [0];
  let current = 0;

  while (unvisited.size > 0) {
    let nearest = -1;
    let nearestCost = Infinity;
    for (const candidate of unvisited) {
      const cost = durationsSec[current][candidate];
      if (cost < nearestCost) {
        nearestCost = cost;
        nearest = candidate;
      }
    }
    sequence.push(nearest);
    unvisited.delete(nearest);
    current = nearest;
  }
  sequence.push(0);
  return evaluateSequence(sequence, durationsSec, distancesMeters, serviceTimesSec);
}