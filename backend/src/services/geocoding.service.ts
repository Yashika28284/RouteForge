import { geocodeAddress, GeocodeResult } from '../clients/nominatim.client';
import { redisCache } from '../clients/redis.client';
import { buildGeocodeCacheKey } from '../utils/cacheKey';

export async function geocode(query: string): Promise<GeocodeResult[]> {
  const cacheKey = buildGeocodeCacheKey(query);
  const cached = await redisCache.get(cacheKey);
  if (cached) {
    return JSON.parse(cached) as GeocodeResult[];
  }
  const results = await geocodeAddress(query);
  await redisCache.setGeocode(cacheKey, JSON.stringify(results));
  return results;
}
