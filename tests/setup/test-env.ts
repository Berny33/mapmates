import crypto from 'node:crypto';
import dotenv from 'dotenv';

export function assertTestDatabaseUrl(url: string | undefined): void {
  let databaseName = '';

  try {
    databaseName = new URL(url ?? '').pathname;
  } catch {
    // A missing or invalid URL is rejected below.
  }

  if (!databaseName.endsWith('_test')) {
    throw new Error(
      'TEST_DATABASE_URL must point to a database whose name ends with _test',
    );
  }
}

export function loadTestEnv(): void {
  dotenv.config({ quiet: true });
  assertTestDatabaseUrl(process.env.TEST_DATABASE_URL);

  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  process.env.BCRYPT_ROUNDS = '4';
  process.env.SESSION_SECRET = crypto.randomBytes(32).toString('hex');
  process.env.AUTH_RATE_LIMIT = '1000';
}
