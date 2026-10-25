import { describe, expect, it, vi } from 'vitest';
import { pool } from '../../src/config/db.js';

describe('test database', () => {
  it('runs against a database whose name ends with _test', async () => {
    const { rows } = await pool.query<{ name: string }>(
      'SELECT current_database() AS name',
    );

    expect(rows[0].name.endsWith('_test')).toBe(true);
  });

  it('has the schema applied', async () => {
    const { rows } = await pool.query<{ tablename: string }>(
      "SELECT tablename FROM pg_tables WHERE schemaname = 'public'",
    );
    const tables = rows.map((row) => row.tablename);

    expect(tables).toEqual(
      expect.arrayContaining(['users', 'trips', 'trip_members', 'session']),
    );
  });
});

describe('database configuration', () => {
  it('throws when DATABASE_URL is not set', async () => {
    const originalDatabaseUrl = process.env.DATABASE_URL;

    delete process.env.DATABASE_URL;
    vi.resetModules();

    try {
      await expect(import('../../src/config/db.js')).rejects.toThrow(
        'DATABASE_URL is not set',
      );
    } finally {
      if (originalDatabaseUrl === undefined) {
        delete process.env.DATABASE_URL;
      } else {
        process.env.DATABASE_URL = originalDatabaseUrl;
      }

      vi.resetModules();
    }
  });
});

describe('database isolation', () => {
  it('can insert a user', async () => {
    await pool.query(
      "INSERT INTO users (name, email, password_hash) VALUES ('Ana', 'ana@example.com', 'test-hash')",
    );
    const { rows } = await pool.query<{ total: number }>(
      'SELECT count(*)::int AS total FROM users',
    );

    expect(rows[0].total).toBe(1);
  });

  it('starts the next test with empty tables', async () => {
    const { rows } = await pool.query<{ total: number }>(
      'SELECT count(*)::int AS total FROM users',
    );

    expect(rows[0].total).toBe(0);
  });
});
