import 'dotenv/config';
import { pool } from '../src/config/db.js';
import { runMigrations } from './migrate.js';

try {
  const applied = await runMigrations(pool);
  console.log(
    applied.length
      ? `Applied: ${applied.join(', ')}`
      : 'Database is up to date',
  );
} finally {
  await pool.end();
}
