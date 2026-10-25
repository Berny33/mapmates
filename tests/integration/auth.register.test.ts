import request from 'supertest';
import { describe, expect, it } from 'vitest';
import app from '../../src/app.js';
import { pool } from '../../src/config/db.js';
import { createAuthService } from '../../src/services/auth.service.js';

const validBody = {
  name: 'Ana',
  email: 'ana@example.com',
  password: 'test-password-123',
};

describe('POST /api/auth/register (US-01)', () => {
  it('creates the account and answers 201', async () => {
    const res = await request(app).post('/api/auth/register').send(validBody);

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      id: expect.any(String),
      name: 'Ana',
      email: 'ana@example.com',
    });
  });

  it('never returns the password or its hash [ST-20]', async () => {
    const res = await request(app).post('/api/auth/register').send(validBody);
    const body = JSON.stringify(res.body);

    expect(body).not.toContain(validBody.password);
    expect(body).not.toContain('password');
  });

  it('stores the password hashed with bcrypt', async () => {
    await request(app).post('/api/auth/register').send(validBody);

    const { rows } = await pool.query<{ password_hash: string }>(
      'SELECT password_hash FROM users WHERE email = $1',
      [validBody.email],
    );

    expect(rows[0].password_hash).not.toBe(validBody.password);
    expect(rows[0].password_hash).toMatch(/^\$2[aby]\$/);
  });

  it('normalizes the email to lowercase and trims the name', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...validBody, name: '  Ana  ', email: '  ANA@Example.COM ' });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Ana');
    expect(res.body.email).toBe('ana@example.com');
  });

  it('rejects an email that is already registered with 409 [ST-01]', async () => {
    await request(app).post('/api/auth/register').send(validBody);

    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...validBody, email: 'ANA@example.com' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_ALREADY_REGISTERED');

    const { rows } = await pool.query<{ total: number }>(
      'SELECT count(*)::int AS total FROM users',
    );
    expect(rows[0].total).toBe(1);
  });

  it.each([
    ['an invalid email', { ...validBody, email: 'not-an-email' }, 'email'],
    ['an empty name', { ...validBody, name: '' }, 'name'],
    [
      'a name longer than 60 characters',
      { ...validBody, name: 'a'.repeat(61) },
      'name',
    ],
    ['a short password', { ...validBody, password: 'short' }, 'password'],
    [
      'a password over 72 bytes',
      { ...validBody, password: 'ñ'.repeat(40) },
      'password',
    ],
    [
      'a missing password',
      { name: 'Ana', email: 'ana@example.com' },
      'password',
    ],
  ])('rejects %s with 400 and names the field', async (_label, body, field) => {
    const res = await request(app).post('/api/auth/register').send(body);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(
      res.body.error.details.some(
        (detail: { field: string }) => detail.field === field,
      ),
    ).toBe(true);
  });

  it('rejects a request without body with 400', async () => {
    const res = await request(app).post('/api/auth/register');

    expect(res.status).toBe(400);
  });

  it('ignores fields that are not part of the schema', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...validBody, id: 'forced-id', role: 'admin' });

    expect(res.status).toBe(201);
    expect(res.body.id).not.toBe('forced-id');
    expect(res.body).not.toHaveProperty('role');
  });

  it('treats SQL injection strings as plain text [ST-12]', async () => {
    const name = "Robert'); DROP TABLE users;--";

    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...validBody, name });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe(name);

    const { rows } = await pool.query<{ total: number }>(
      'SELECT count(*)::int AS total FROM users',
    );
    expect(rows[0].total).toBe(1);
  });
});

describe('auth service', () => {
  it('rethrows unexpected database errors', async () => {
    const service = createAuthService({
      userModel: {
        create: async () => {
          throw new Error('database is down');
        },
      },
    });

    await expect(service.register(validBody)).rejects.toThrow(
      'database is down',
    );
  });
});
