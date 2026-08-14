import 'dotenv/config';
import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),

  // Either DATABASE_URL (e.g. Neon's connection string) or the discrete
  // POSTGRES_* vars must be provided — see the refine() below.
  DATABASE_URL: z.string().optional(),
  POSTGRES_HOST: z.string().optional(),
  POSTGRES_PORT: z.coerce.number().default(5432),
  POSTGRES_DB: z.string().optional(),
  POSTGRES_USER: z.string().optional(),
  POSTGRES_PASSWORD: z.string().optional(),
  // Managed Postgres (Neon, RDS, etc.) requires SSL; local Docker Postgres doesn't.
  POSTGRES_SSL: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),

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
  const data = parsed.data;
  const hasDiscretePgVars = data.POSTGRES_HOST && data.POSTGRES_DB && data.POSTGRES_USER && data.POSTGRES_PASSWORD;
  if (!data.DATABASE_URL && !hasDiscretePgVars) {
    throw new Error(
      'Invalid environment configuration: set either DATABASE_URL or POSTGRES_HOST/POSTGRES_DB/POSTGRES_USER/POSTGRES_PASSWORD',
    );
  }
  return data;
}

export const env = loadEnv();
