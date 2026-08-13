import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { env } from './config/env';
import { registerRoutes } from './routes';
import { errorHandler } from './middleware/error.middleware';

export function buildApp(): FastifyInstance {
  const app = Fastify({ logger: false, genReqId: () => crypto.randomUUID() });

  app.register(cors, { origin: env.CORS_ORIGIN, credentials: true });
  app.register(rateLimit, { max: 100, timeWindow: '1 minute' });

  app.setErrorHandler(errorHandler);

  app.register(registerRoutes);

  return app;
}
