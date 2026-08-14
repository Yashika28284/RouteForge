import { describe, it, expect } from 'vitest';

process.env.JWT_SECRET = 'test-secret-key-for-unit-tests';
process.env.POSTGRES_HOST = 'localhost';
process.env.POSTGRES_DB = 'test';
process.env.POSTGRES_USER = 'test';
process.env.POSTGRES_PASSWORD = 'test';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.OPTIMIZE_SERVICE_URL = 'http://localhost:8000';
process.env.OSRM_BASE_URL = 'http://localhost:5000';
process.env.NOMINATIM_BASE_URL = 'http://localhost:8080';
process.env.CORS_ORIGIN = 'https://routeforge.vercel.app,http://localhost:5173';
process.env.CORS_ORIGIN_REGEX = '^https://routeforge-git-[a-z0-9-]+-yourteam\\.vercel\\.app$';

const { corsOriginCheck } = await import('../../src/config/cors');

function check(origin: string | undefined): Promise<boolean> {
  return new Promise((resolve, reject) => {
    corsOriginCheck(origin, (err, allow) => (err ? reject(err) : resolve(allow)));
  });
}

describe('corsOriginCheck', () => {
  it('allows an exact match from the comma-separated allowlist', async () => {
    expect(await check('https://routeforge.vercel.app')).toBe(true);
    expect(await check('http://localhost:5173')).toBe(true);
  });

  it('rejects an origin not on the allowlist', async () => {
    expect(await check('https://evil.example.com')).toBe(false);
  });

  it('allows requests with no Origin header (same-origin, curl, server-to-server)', async () => {
    expect(await check(undefined)).toBe(true);
  });

  it('allows an origin matching the configured preview regex', async () => {
    expect(await check('https://routeforge-git-feature-x-yourteam.vercel.app')).toBe(true);
  });

  it('rejects an origin that only partially matches the preview regex', async () => {
    expect(await check('https://routeforge-git-feature-x-yourteam.vercel.app.evil.com')).toBe(false);
    expect(await check('https://notrouteforge-git-x-yourteam.vercel.app')).toBe(false);
  });
});
