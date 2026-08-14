import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { registerRoutes } from './routes';
import { errorHandler } from './middleware/error.middleware';
import { corsOriginCheck } from './config/cors';

export function buildApp(): FastifyInstance {
  const app = Fastify({ logger: false, genReqId: () => crypto.randomUUID() });

  // Security headers (CSP, X-Frame-Options, X-Content-Type-Options, etc.).
  // This is a JSON API with no HTML views of its own, so a locked-down CSP
  // with no exceptions is safe here.
  app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
  });

  // Auth is Bearer-token-only (no cookies), so credentials: true would only
  // widen the CORS surface for no benefit.
  app.register(cors, { origin: corsOriginCheck, credentials: false });

  // Baseline rate limit for the whole API.
  app.register(rateLimit, { max: 100, timeWindow: '1 minute' });

  app.setErrorHandler(errorHandler);

  app.register(registerRoutes);

  return app;
}
