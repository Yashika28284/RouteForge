import { createHash } from 'node:crypto';

export interface MatrixCoord {
  lat: number;
  lng: number;
}

/**
 * Builds a deterministic cache key for an OSRM matrix request.
 * Coordinates are rounded to 6 decimal places (~11cm precision) and
 * order-independent within the key so that requesting the same set of
 * points (regardless of array order) hits the same cache entry.
 */
export function buildMatrixCacheKey(coords: MatrixCoord[], profile = 'driving'): string {
  const normalized = coords
    .map((c) => `${c.lat.toFixed(6)},${c.lng.toFixed(6)}`)
    .sort() // order-independent
    .join('|');
  const hash = createHash('sha256').update(`${profile}::${normalized}`).digest('hex');
  return `route:matrix:${hash}`;
}

export function buildGeocodeCacheKey(query: string): string {
  const normalized = query.trim().toLowerCase().replace(/\s+/g, ' ');
  const hash = createHash('sha256').update(normalized).digest('hex');
  return `geocode:${hash}`;
}
