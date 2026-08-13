import { createClient, RedisClientType } from 'redis';
import { env } from '../config/env';
import { logger } from '../utils/logger';

const MATRIX_TTL_SECONDS = 60 * 60 * 24; // 24h
const GEOCODE_TTL_SECONDS = 60 * 60 * 24 * 7; // 7d

class RedisCache {
  private client: RedisClientType;
  private connected = false;
  private warnedOnce = false;

  constructor() {
    this.client = createClient({ url: env.REDIS_URL });
    this.client.on('error', () => {
      // Swallow repeated errors; connectivity is treated as best-effort.
      if (!this.warnedOnce) {
        logger.warn('Redis connection error — caching disabled until it recovers');
        this.warnedOnce = true;
      }
    });
  }

  async connect() {
    try {
      await this.client.connect();
      this.connected = true;
      logger.info('Connected to Redis');
    } catch {
      this.connected = false;
      logger.warn('Could not connect to Redis at startup — continuing without cache');
    }
  }

  async isHealthy(): Promise<boolean> {
    try {
      await this.client.ping();
      return true;
    } catch {
      return false;
    }
  }

  async get(key: string): Promise<string | null> {
    if (!this.connected) return null;
    try {
      return await this.client.get(key);
    } catch {
      return null; // cache miss on failure — never throw
    }
  }

  async setMatrix(key: string, value: string): Promise<void> {
    await this.safeSet(key, value, MATRIX_TTL_SECONDS);
  }

  async setGeocode(key: string, value: string): Promise<void> {
    await this.safeSet(key, value, GEOCODE_TTL_SECONDS);
  }

  private async safeSet(key: string, value: string, ttlSeconds: number): Promise<void> {
    if (!this.connected) return;
    try {
      await this.client.set(key, value, { EX: ttlSeconds });
    } catch {
      // Best-effort cache; failures are non-fatal.
    }
  }

  async del(key: string): Promise<void> {
    if (!this.connected) return;
    try {
      await this.client.del(key);
    } catch {
      /* noop */
    }
  }
}

export const redisCache = new RedisCache();
