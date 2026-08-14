/**
 * Minimal migration runner: applies schema.sql idempotently.
 * Run with: npm run migrate
 */
import fs from 'node:fs';
import path from 'node:path';
import { pool } from './pool';

async function migrate() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf-8');
  // eslint-disable-next-line no-console
  console.log('Applying schema.sql ...');
  await pool.query(sql);
  // eslint-disable-next-line no-console
  console.log('Schema applied successfully.');
  await pool.end();
}

migrate().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Migration failed:', err);
  process.exit(1);
});
