import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    env: {
      JWT_SECRET: 'test-secret-key-for-unit-and-api-tests',
      POSTGRES_HOST: 'localhost',
      POSTGRES_DB: 'test',
      POSTGRES_USER: 'test',
      POSTGRES_PASSWORD: 'test',
      REDIS_URL: 'redis://localhost:6379',
      OPTIMIZE_SERVICE_URL: 'http://localhost:8000',
      OSRM_BASE_URL: 'http://localhost:5000',
      NOMINATIM_BASE_URL: 'http://localhost:8080',
    },
  },
});
