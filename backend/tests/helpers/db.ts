import { pool } from '../../src/config/db.js';

export async function resetDatabase(): Promise<void> {
  await pool.query('TRUNCATE users, trips, trip_members, session CASCADE');
}
