import { Pool } from 'pg';
import { env } from '../config/env';

// Managed providers (Neon, RDS, etc.) terminate with a cert that Node's
// default CA bundle usually can't verify chain-of-trust for; rejectUnauthorized:
// false keeps the connection encrypted without requiring the provider's CA
// bundle. Fine for this app's threat model; local Docker Postgres has no SSL.
const ssl = env.POSTGRES_SSL ? { rejectUnauthorized: false } : undefined;

export const pool = env.DATABASE_URL
  ? new Pool({
      connectionString: env.DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 30_000,
      ssl,
    })
  : new Pool({
      host: env.POSTGRES_HOST,
      port: env.POSTGRES_PORT,
      database: env.POSTGRES_DB,
      user: env.POSTGRES_USER,
      password: env.POSTGRES_PASSWORD,
      max: 10,
      idleTimeoutMillis: 30_000,
      ssl,
    });

export async function checkDbHealth(): Promise<boolean> {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}
