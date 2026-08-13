import { RouteRow } from '../repositories/route.repository';
import { StopRow, stopRepository } from '../repositories/stop.repository';
import { getRoutingMatrix } from './routing.service';
import { computeNearestNeighborBaseline, computeOriginalOrderBaseline } from './baseline.service';
import { solveTsp } from '../clients/optimize.client';
import { routeRepository } from '../repositories/route.repository';

export class OptimizationValidationError extends Error {
  status = 422;
}

export interface OptimizedStop {
  stopId: string;
  address: string;
  latitude: number;
  longitude: number;
  sequence: number;
  legDistanceKm: number;
  legDurationMin: number;
}

export interface OptimizationResponse {
  route: OptimizedStop[];
  totalDistanceKm: number;
  totalDurationMinutes: number;
  executionTimeMs: number;
  performance: {
    matrixTimeMs: number;
    solverTimeMs: number;
    totalTimeMs: number;
    cacheHit: boolean;
  };
  baseline: {
    strategy: 'ORIGINAL_ORDER' | 'NEAREST_NEIGHBOR';
    distanceKm: number;
    durationMinutes: number;
  };
  improvement: {
    distancePercent: number;
    timePercent: number;
  };
}

function toTimeWindowSeconds(stop: StopRow): [number, number] | null {
  if (!stop.time_window_start || !stop.time_window_end) return null;
  const toSeconds = (t: string) => {
    const [h, m, s] = t.split(':').map(Number);
    return h * 3600 + m * 60 + (s ?? 0);
  };
  const start = toSeconds(stop.time_window_start);
  const end = toSeconds(stop.time_window_end);
  if (end <= start) {
    throw new OptimizationValidationError(
      `Stop "${stop.address}" has an impossible time window (end must be after start).`
    );
  }
  return [start, end];
}

export async function optimizeRoute(route: RouteRow): Promise<OptimizationResponse> {
  const overallStart = Date.now();

  if (route.depot_lat === null || route.depot_lng === null) {
    throw new OptimizationValidationError('Route has no depot location set.');
  }

  const stops = await stopRepository.findAllForRoute(route.id);
  if (stops.length < 1) {
    throw new OptimizationValidationError('A route needs at least 1 stop to optimize.');
  }
  if (stops.length > 10) {
    throw new OptimizationValidationError('This MVP supports at most 10 stops per route.');
  }

  const seen = new Set<string>();
  for (const s of stops) {
    const key = `${s.latitude.toFixed(6)},${s.longitude.toFixed(6)}`;
    if (seen.has(key)) {
      throw new OptimizationValidationError(`Duplicate coordinates detected at "${s.address}".`);
    }
    seen.add(key);
    if (s.latitude < -90 || s.latitude > 90 || s.longitude < -180 || s.longitude > 180) {
      throw new OptimizationValidationError(`Stop "${s.address}" has invalid coordinates.`);
    }
  }

  const timeWindows = stops.map((s) => toTimeWindowSeconds(s));

  const coords = [{ lat: route.depot_lat, lng: route.depot_lng }, ...stops.map((s) => ({ lat: s.latitude, lng: s.longitude }))];

  const matrix = await getRoutingMatrix(coords);

  const solveResult = await solveTsp({
    durationsSec: matrix.durationsSec,
    distancesMeters: matrix.distancesMeters,
    objective: route.optimization_objective,
    timeWindows: [null, ...timeWindows],
    serviceTimesSec: [0, ...stops.map((s) => s.service_duration_min * 60)],
  });

  if (!solveResult.feasible) {
    throw new OptimizationValidationError(
      'No feasible route found for the given time windows. Try widening a delivery window.'
    );
  }

  // Node 0 is the depot (no service time); nodes 1..n are stops in order.
  const serviceTimesSec = [0, ...stops.map((s) => s.service_duration_min * 60)];
  const originalBaseline = computeOriginalOrderBaseline(
    stops.length,
    matrix.durationsSec,
    matrix.distancesMeters,
    serviceTimesSec
  );
  const nnBaseline = computeNearestNeighborBaseline(
    stops.length,
    matrix.durationsSec,
    matrix.distancesMeters,
    serviceTimesSec
  );
  const baseline = nnBaseline.totalDurationSec < originalBaseline.totalDurationSec ? nnBaseline : originalBaseline;
  const baselineStrategy = baseline === nnBaseline ? 'NEAREST_NEIGHBOR' : 'ORIGINAL_ORDER';

  // Build ordered stop list (skip depot at index 0, and the closing depot leg)
  const orderedStops: OptimizedStop[] = [];
  for (let i = 1; i < solveResult.sequence.length - 1; i++) {
    const nodeIdx = solveResult.sequence[i];
    const prevNodeIdx = solveResult.sequence[i - 1];
    const stop = stops[nodeIdx - 1]; // -1 because node 0 is depot
    orderedStops.push({
      stopId: stop.id,
      address: stop.address,
      latitude: stop.latitude,
      longitude: stop.longitude,
      sequence: i - 1,
      legDistanceKm: round2(matrix.distancesMeters[prevNodeIdx][nodeIdx] / 1000),
      legDurationMin: round2(matrix.durationsSec[prevNodeIdx][nodeIdx] / 60),
    });
  }

  await stopRepository.saveSequence(route.id, orderedStops.map((s) => s.stopId));

  const totalDistanceKm = round2(solveResult.totalDistanceMeters / 1000);
  const totalDurationMinutes = round2(solveResult.totalDurationSec / 60);
  const baselineDistanceKm = round2(baseline.totalDistanceMeters / 1000);
  const baselineDurationMinutes = round2(baseline.totalDurationSec / 60);

  const executionTimeMs = Date.now() - overallStart;

  await routeRepository.saveOptimizationResult(route.id, {
    totalDistanceKm,
    totalDurationMin: totalDurationMinutes,
    baselineDistanceKm,
    baselineDurationMin: baselineDurationMinutes,
    matrixTimeMs: matrix.matrixTimeMs,
    solverTimeMs: solveResult.solverTimeMs,
    executionTimeMs,
  });

  return {
    route: orderedStops,
    totalDistanceKm,
    totalDurationMinutes,
    executionTimeMs,
    performance: {
      matrixTimeMs: matrix.matrixTimeMs,
      solverTimeMs: solveResult.solverTimeMs,
      totalTimeMs: executionTimeMs,
      cacheHit: matrix.cacheHit,
    },
    baseline: {
      strategy: baselineStrategy,
      distanceKm: baselineDistanceKm,
      durationMinutes: baselineDurationMinutes,
    },
    improvement: {
      distancePercent: percentImprovement(baselineDistanceKm, totalDistanceKm),
      timePercent: percentImprovement(baselineDurationMinutes, totalDurationMinutes),
    },
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function percentImprovement(baseline: number, optimized: number): number {
  if (baseline <= 0) return 0;
  return round2(((baseline - optimized) / baseline) * 100);
}