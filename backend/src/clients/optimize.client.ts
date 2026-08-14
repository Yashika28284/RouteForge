import { env } from '../config/env';
import { logger } from '../utils/logger';

export interface SolveRequest {
  durationsSec: number[][];
  distancesMeters: number[][];
  objective: 'TIME' | 'DISTANCE';
  timeWindows?: Array<[number, number] | null>; // seconds from route start, per node (index 0 = depot)
  serviceTimesSec?: number[]; // per node
}

export interface SolveResponse {
  sequence: number[]; // node indices in visiting order, starting and ending at depot (index 0)
  totalDistanceMeters: number;
  totalDurationSec: number;
  solverTimeMs: number;
  feasible: boolean;
}

const OPTIMIZE_TIMEOUT_MS = 10_000;

export async function solveTsp(req: SolveRequest): Promise<SolveResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OPTIMIZE_TIMEOUT_MS);

  try {
    const res = await fetch(`${env.OPTIMIZE_SERVICE_URL}/solve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Optimize service responded ${res.status}: ${body}`);
    }
    return (await res.json()) as SolveResponse;
  } catch (err) {
    logger.error('Optimize service call failed', { error: (err as Error).message });
    throw new OptimizeServiceError('The optimization engine is currently unavailable.');
  } finally {
    clearTimeout(timeout);
  }
}

export class OptimizeServiceError extends Error {
  code = 'OPTIMIZE_SERVICE_UNAVAILABLE';
}
