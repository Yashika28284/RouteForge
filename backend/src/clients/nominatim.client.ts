import { env } from '../config/env';
import { logger } from '../utils/logger';

export interface GeocodeResult {
  lat: number;
  lng: number;
  displayName: string;
}

const NOMINATIM_TIMEOUT_MS = 6000;

export async function geocodeAddress(query: string): Promise<GeocodeResult[]> {
  const url = `${env.NOMINATIM_BASE_URL}/search?q=${encodeURIComponent(query)}&format=json&limit=5`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), NOMINATIM_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': env.NOMINATIM_USER_AGENT },
    });
    if (!res.ok) {
      throw new Error(`Nominatim responded with status ${res.status}`);
    }
    const data = (await res.json()) as Array<{ lat: string; lon: string; display_name: string }>;
    return data.map((d) => ({
      lat: parseFloat(d.lat),
      lng: parseFloat(d.lon),
      displayName: d.display_name,
    }));
  } catch (err) {
    logger.error('Geocoding request failed', { error: (err as Error).message });
    throw new Error('GEOCODING_SERVICE_UNAVAILABLE');
  } finally {
    clearTimeout(timeout);
  }
}
