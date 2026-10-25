import { loadTestEnv } from './test-env.js';

export async function setup(): Promise<void> {
  loadTestEnv();

  const { pool } = await import('../../src/config/db.js');
  const { runMigrations } = await import('../../db/migrate.js');

  await runMigrations(pool);
  await pool.end();
}
