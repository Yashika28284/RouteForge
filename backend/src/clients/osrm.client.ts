import { env } from '../config/env';
import { logger } from '../utils/logger';

export interface Coord {
  lat: number;
  lng: number;
}

export interface OsrmMatrixResult {
  durationsSec: number[][]; // [from][to] travel time in seconds
  distancesMeters: number[][]; // [from][to] distance in meters
}

const OSRM_TIMEOUT_MS = 8000;

/**
 * Calls OSRM's /table service to get a real road-network duration + distance
 * matrix for a set of coordinates. This is the piece that replaces
 * straight-line/Haversine distance with actual road travel data.
 */
export async function fetchOsrmMatrix(coords: Coord[]): Promise<OsrmMatrixResult> {
  if (coords.length < 2) {
    throw new Error('At least 2 coordinates are required for a matrix request');
  }

  // OSRM expects lng,lat order.
  const coordString = coords.map((c) => `${c.lng},${c.lat}`).join(';');
  const url = `${env.OSRM_BASE_URL}/table/v1/driving/${coordString}?annotations=duration,distance`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OSRM_TIMEOUT_MS);

  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      throw new Error(`OSRM responded with status ${res.status}`);
    }
    const data = (await res.json()) as {
      code: string;
      durations: number[][];
      distances: number[][];
    };
    if (data.code !== 'Ok') {
      throw new Error(`OSRM error code: ${data.code}`);
    }
    return { durationsSec: data.durations, distancesMeters: data.distances };
  } catch (err) {
    logger.error('OSRM matrix request failed', { error: (err as Error).message });
    throw new RoutingServiceError('Unable to retrieve road network data.');
  } finally {
    clearTimeout(timeout);
  }
}

export class RoutingServiceError extends Error {
  code = 'ROUTING_SERVICE_UNAVAILABLE';
}
