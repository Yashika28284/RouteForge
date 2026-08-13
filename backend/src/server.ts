import { buildApp } from './app';
import { env } from './config/env';
import { redisCache } from './clients/redis.client';
import { logger } from './utils/logger';

async function start() {
  await redisCache.connect();
  const app = buildApp();

  try {
    await app.listen({ port: env.PORT, host: '0.0.0.0' });
    logger.info(`RouteForge API listening on port ${env.PORT}`);
  } catch (err) {
    logger.error('Failed to start server', { error: (err as Error).message });
    process.exit(1);
  }
}

start();
