import { afterAll, beforeEach } from 'vitest';
import { pool } from '../../src/config/db.js';
import { resetDatabase } from '../helpers/db.js';

beforeEach(resetDatabase);

afterAll(async () => {
  await pool.end();
});
