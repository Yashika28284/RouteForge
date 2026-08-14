import { Pool } from 'pg';
import { env } from '../config/env';

// Managed providers (Neon, RDS, etc.) use certs from publicly trusted CAs,
// which Node's default trust store already verifies — so full verification
// (rejectUnauthorized: true) works out of the box and is the secure default.
// POSTGRES_SSL_INSECURE is an explicit escape hatch for providers with a
// self-signed/private cert chain; it disables verification (still
// encrypted, but no longer authenticated) so it should only be used
// deliberately, never as a default.
const ssl = env.POSTGRES_SSL
  ? { rejectUnauthorized: !env.POSTGRES_SSL_INSECURE }
  : undefined;

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
