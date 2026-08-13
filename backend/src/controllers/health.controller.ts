import { FastifyReply, FastifyRequest } from 'fastify';
import { checkDbHealth } from '../db/pool';
import { redisCache } from '../clients/redis.client';

export async function health(_req: FastifyRequest, reply: FastifyReply) {
  return reply.send({ status: 'ok' });
}

export async function readiness(_req: FastifyRequest, reply: FastifyReply) {
  const [postgres, redis] = await Promise.all([checkDbHealth(), redisCache.isHealthy()]);
  const ready = postgres; // redis is best-effort, not required for readiness
  return reply.status(ready ? 200 : 503).send({ postgres, redis });
}
