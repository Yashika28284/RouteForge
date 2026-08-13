/**
 * API-level tests with the DB layer mocked out, so they run fast without
 * needing a live Postgres instance. True integration tests (real Postgres +
 * Redis via docker-compose service containers) run in CI — see
 * .github/workflows/ci.yml.
 */
process.env.JWT_SECRET = 'test-secret-key-for-api-tests-only';
process.env.POSTGRES_HOST = 'localhost';
process.env.POSTGRES_DB = 'test';
process.env.POSTGRES_USER = 'test';
process.env.POSTGRES_PASSWORD = 'test';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.OPTIMIZE_SERVICE_URL = 'http://localhost:8000';
process.env.OSRM_BASE_URL = 'http://localhost:5000';
process.env.NOMINATIM_BASE_URL = 'http://localhost:8080';

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

vi.mock('../../src/repositories/user.repository', () => ({
  userRepository: {
    findByEmail: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
  },
}));
vi.mock('../../src/clients/redis.client', () => ({
  redisCache: {
    connect: vi.fn(),
    get: vi.fn().mockResolvedValue(null),
    setMatrix: vi.fn(),
    setGeocode: vi.fn(),
    del: vi.fn(),
    isHealthy: vi.fn().mockResolvedValue(true),
  },
}));

import { userRepository } from '../../src/repositories/user.repository';
import { buildApp } from '../../src/app';

describe('POST /api/auth/register', () => {
  beforeEach(() => vi.clearAllMocks());

  it('registers a new user and returns a token', async () => {
    (userRepository.findByEmail as any).mockResolvedValue(null);
    (userRepository.create as any).mockResolvedValue({
      id: 'user-1',
      email: 'new@user.com',
      password_hash: 'hashed',
      created_at: new Date().toISOString(),
    });

    const app = buildApp();
    await app.ready();
    const res = await request(app.server)
      .post('/api/auth/register')
      .send({ email: 'new@user.com', password: 'supersecure123' });

    expect(res.status).toBe(201);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.user.email).toBe('new@user.com');
    expect(res.body.user.password_hash).toBeUndefined();
  });

  it('rejects a duplicate email with 409', async () => {
    (userRepository.findByEmail as any).mockResolvedValue({ id: 'existing', email: 'dupe@user.com' });

    const app = buildApp();
    await app.ready();
    const res = await request(app.server)
      .post('/api/auth/register')
      .send({ email: 'dupe@user.com', password: 'supersecure123' });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('AUTH_ERROR');
  });

  it('rejects an invalid email with 400', async () => {
    const app = buildApp();
    await app.ready();
    const res = await request(app.server)
      .post('/api/auth/register')
      .send({ email: 'not-an-email', password: 'supersecure123' });

    expect(res.status).toBe(400);
  });

  it('rejects a short password', async () => {
    const app = buildApp();
    await app.ready();
    const res = await request(app.server)
      .post('/api/auth/register')
      .send({ email: 'ok@user.com', password: 'short' });

    expect(res.status).toBe(400);
  });
});

describe('protected routes without a token', () => {
  it('returns 401 for GET /api/routes with no Authorization header', async () => {
    const app = buildApp();
    await app.ready();
    const res = await request(app.server).get('/api/routes');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('UNAUTHORIZED');
  });
});
