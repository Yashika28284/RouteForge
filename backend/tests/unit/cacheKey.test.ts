import { describe, it, expect } from 'vitest';
import { buildMatrixCacheKey, buildGeocodeCacheKey } from '../../src/utils/cacheKey';

describe('buildMatrixCacheKey', () => {
  it('produces the same key regardless of coordinate order', () => {
    const a = [{ lat: 30.34, lng: 76.38 }, { lat: 30.35, lng: 76.39 }];
    const b = [{ lat: 30.35, lng: 76.39 }, { lat: 30.34, lng: 76.38 }];
    expect(buildMatrixCacheKey(a)).toEqual(buildMatrixCacheKey(b));
  });

  it('produces a different key for different coordinates', () => {
    const a = [{ lat: 30.34, lng: 76.38 }, { lat: 30.35, lng: 76.39 }];
    const b = [{ lat: 30.34, lng: 76.38 }, { lat: 31.35, lng: 76.39 }];
    expect(buildMatrixCacheKey(a)).not.toEqual(buildMatrixCacheKey(b));
  });

  it('produces different keys for different routing profiles', () => {
    const coords = [{ lat: 30.34, lng: 76.38 }, { lat: 30.35, lng: 76.39 }];
    expect(buildMatrixCacheKey(coords, 'driving')).not.toEqual(buildMatrixCacheKey(coords, 'cycling'));
  });
});

describe('buildGeocodeCacheKey', () => {
  it('normalizes whitespace and case', () => {
    expect(buildGeocodeCacheKey('Connaught Place, Delhi')).toEqual(
      buildGeocodeCacheKey('  connaught   place, delhi  ')
    );
  });
});
