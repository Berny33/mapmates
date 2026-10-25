import dotenv from 'dotenv';
import { assertTestDatabaseUrl } from './test-env.js';

dotenv.config({ quiet: true });

try {
  assertTestDatabaseUrl(process.env.TEST_DATABASE_URL);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
