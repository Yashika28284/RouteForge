import { fetchOsrmMatrix, Coord } from '../clients/osrm.client';
import { redisCache } from '../clients/redis.client';
import { buildMatrixCacheKey } from '../utils/cacheKey';
import { logger } from '../utils/logger';

export interface MatrixResult {
  durationsSec: number[][];
  distancesMeters: number[][];
  cacheHit: boolean;
  matrixTimeMs: number;
}

/**
 * Returns a real road-network duration/distance matrix for the given
 * coordinates, transparently using Redis as a cache in front of OSRM.
 * Coordinates are used in the exact order passed in — callers are
 * responsible for keeping index 0 as the depot.
 */
export async function getRoutingMatrix(coords: Coord[]): Promise<MatrixResult> {
  const start = Date.now();
  const cacheKey = buildMatrixCacheKey(coords);

  const cached = await redisCache.get(cacheKey);
  if (cached) {
    const parsed = JSON.parse(cached) as { order: Coord[]; durationsSec: number[][]; distancesMeters: number[][] };
    const remapped = remapMatrixToRequestedOrder(parsed, coords);
    if (remapped) {
      logger.info('Routing matrix cache hit', { cacheKey });
      return { ...remapped, cacheHit: true, matrixTimeMs: Date.now() - start };
    }
  }

  const result = await fetchOsrmMatrix(coords);
  await redisCache.setMatrix(cacheKey, JSON.stringify({ order: coords, ...result }));

  return { ...result, cacheHit: false, matrixTimeMs: Date.now() - start };
}

/**
 * The cache key is order-independent (sorted coordinates), but OSRM's
 * response matrix is order-dependent. This remaps a cached matrix (stored
 * against whatever order it was originally fetched in) back to the order
 * the current caller asked for.
 */
function remapMatrixToRequestedOrder(
  cached: { order: Coord[]; durationsSec: number[][]; distancesMeters: number[][] },
  requested: Coord[]
): { durationsSec: number[][]; distancesMeters: number[][] } | null {
  const indexMap = requested.map((r) =>
    cached.order.findIndex((c) => c.lat.toFixed(6) === r.lat.toFixed(6) && c.lng.toFixed(6) === r.lng.toFixed(6))
  );
  if (indexMap.some((i) => i === -1)) return null;

  const durationsSec = indexMap.map((fromIdx) => indexMap.map((toIdx) => cached.durationsSec[fromIdx][toIdx]));
  const distancesMeters = indexMap.map((fromIdx) => indexMap.map((toIdx) => cached.distancesMeters[fromIdx][toIdx]));
  return { durationsSec, distancesMeters };
}
