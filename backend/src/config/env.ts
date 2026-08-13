import 'dotenv/config';
import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),

  POSTGRES_HOST: z.string(),
  POSTGRES_PORT: z.coerce.number().default(5432),
  POSTGRES_DB: z.string(),
  POSTGRES_USER: z.string(),
  POSTGRES_PASSWORD: z.string(),

  REDIS_URL: z.string(),

  JWT_SECRET: z.string().min(10, 'JWT_SECRET must be set to a real secret'),
  JWT_EXPIRES_IN: z.string().default('1d'),

  OPTIMIZE_SERVICE_URL: z.string().url(),
  OSRM_BASE_URL: z.string().url(),
  NOMINATIM_BASE_URL: z.string().url(),
  NOMINATIM_USER_AGENT: z.string().default('routeforge-app'),
});

export type Env = z.infer<typeof EnvSchema>;

function loadEnv(): Env {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    // eslint-disable-next-line no-console
    console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
    throw new Error('Invalid environment configuration');
  }
  return parsed.data;
}

export const env = loadEnv();
