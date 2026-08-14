import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

vi.mock('../../src/repositories/route.repository', () => ({
  routeRepository: {
    findAllForUser: vi.fn(),
    findByIdForUser: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    saveOptimizationResult: vi.fn(),
  },
}));
vi.mock('../../src/repositories/stop.repository', () => ({
  stopRepository: {
    findAllForRoute: vi.fn().mockResolvedValue([]),
    findOne: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    saveSequence: vi.fn(),
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

import { routeRepository } from '../../src/repositories/route.repository';
import { buildApp } from '../../src/app';
import { signToken } from '../../src/utils/jwt';

const authHeader = `Bearer ${signToken({ userId: 'user-1', email: 'a@b.com' })}`;
const otherUserAuthHeader = `Bearer ${signToken({ userId: 'user-2', email: 'other@b.com' })}`;

describe('Route CRUD ownership enforcement', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a route for the authenticated user', async () => {
    (routeRepository.create as any).mockResolvedValue({ id: 'route-1', user_id: 'user-1', name: 'My Route' });

    const app = buildApp();
    await app.ready();
    const res = await request(app.server)
      .post('/api/routes')
      .set('Authorization', authHeader)
      .send({ name: 'My Route', optimizationObjective: 'TIME' });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('My Route');
  });

  it('rejects an empty route name with 400', async () => {
    const app = buildApp();
    await app.ready();
    const res = await request(app.server)
      .post('/api/routes')
      .set('Authorization', authHeader)
      .send({ name: '' });

    expect(res.status).toBe(400);
  });

  it("returns 404 when a user requests another user's route (ownership enforced)", async () => {
    (routeRepository.findByIdForUser as any).mockResolvedValue(null); // repo scopes by user_id already

    const app = buildApp();
    await app.ready();
    const res = await request(app.server)
      .get('/api/routes/route-belonging-to-user-1')
      .set('Authorization', otherUserAuthHeader);

    expect(res.status).toBe(404);
  });

  it('returns the route with its stops for the owning user', async () => {
    (routeRepository.findByIdForUser as any).mockResolvedValue({ id: 'route-1', user_id: 'user-1', name: 'Mine' });

    const app = buildApp();
    await app.ready();
    const res = await request(app.server).get('/api/routes/route-1').set('Authorization', authHeader);

    expect(res.status).toBe(200);
    expect(res.body.stops).toEqual([]);
  });
});

describe('POST /api/routes/:id/optimize edge cases', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 422 when the route has 0 stops', async () => {
    (routeRepository.findByIdForUser as any).mockResolvedValue({
      id: 'route-1',
      user_id: 'user-1',
      depot_lat: 30.34,
      depot_lng: 76.38,
      optimization_objective: 'TIME',
    });

    const app = buildApp();
    await app.ready();
    const res = await request(app.server)
      .post('/api/routes/route-1/optimize')
      .set('Authorization', authHeader)
      .send({});

    expect(res.status).toBe(422);
    expect(res.body.error).toBe('VALIDATION_ERROR');
  });

  it('returns 422 when the route has no depot set', async () => {
    (routeRepository.findByIdForUser as any).mockResolvedValue({
      id: 'route-1',
      user_id: 'user-1',
      depot_lat: null,
      depot_lng: null,
      optimization_objective: 'TIME',
    });

    const app = buildApp();
    await app.ready();
    const res = await request(app.server)
      .post('/api/routes/route-1/optimize')
      .set('Authorization', authHeader)
      .send({});

    expect(res.status).toBe(422);
  });
});
