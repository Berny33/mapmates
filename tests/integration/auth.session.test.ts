import request from 'supertest';
import { describe, expect, it } from 'vitest';
import app from '../../src/app.js';
import { pool } from '../../src/config/db.js';

const credentials = {
  email: 'ana@example.com',
  password: 'test-password-123',
};

async function registerUser(): Promise<void> {
  await request(app)
    .post('/api/auth/register')
    .send({ name: 'Ana', ...credentials })
    .expect(201);
}

function sessionCookie(res: { headers: Record<string, unknown> }): string {
  return String(res.headers['set-cookie']).split(';')[0];
}

async function countSessions(): Promise<number> {
  const { rows } = await pool.query<{ total: number }>(
    'SELECT count(*)::int AS total FROM session',
  );

  return rows[0].total;
}

describe('POST /api/auth/login (US-02)', () => {
  it('logs in with valid credentials and starts a session', async () => {
    await registerUser();

    const res = await request(app).post('/api/auth/login').send(credentials);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      id: expect.any(String),
      name: 'Ana',
      email: 'ana@example.com',
    });
    expect(String(res.headers['set-cookie'])).toContain('HttpOnly');
    expect(String(res.headers['set-cookie'])).toContain('SameSite=Lax');
  });

  it('accepts the email in any capitalization', async () => {
    await registerUser();

    const res = await request(app)
      .post('/api/auth/login')
      .send({ ...credentials, email: '  ANA@Example.com ' });

    expect(res.status).toBe(200);
  });

  it('never returns the password or its hash [ST-20]', async () => {
    await registerUser();

    const res = await request(app).post('/api/auth/login').send(credentials);
    const body = JSON.stringify(res.body);

    expect(body).not.toContain(credentials.password);
    expect(body).not.toContain('password');
  });

  it('answers 401 with the same message for a wrong password and an unknown email [ST-02]', async () => {
    await registerUser();

    const wrongPassword = await request(app)
      .post('/api/auth/login')
      .send({ ...credentials, password: 'another-password-1' });
    const unknownEmail = await request(app)
      .post('/api/auth/login')
      .send({ ...credentials, email: 'nobody@example.com' });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.body.error.code).toBe('INVALID_CREDENTIALS');
    expect(unknownEmail.body).toEqual(wrongPassword.body);
    expect(wrongPassword.headers['set-cookie']).toBeUndefined();
  });

  it.each([
    ['a missing email', { password: credentials.password }],
    ['an invalid email', { ...credentials, email: 'not-an-email' }],
    ['a missing password', { email: credentials.email }],
    ['an empty password', { ...credentials, password: '' }],
  ])('rejects %s with 400', async (_label, body) => {
    const res = await request(app).post('/api/auth/login').send(body);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('treats SQL injection strings as plain text [ST-12]', async () => {
    await registerUser();

    const inEmail = await request(app)
      .post('/api/auth/login')
      .send({ ...credentials, email: "' OR '1'='1" });
    const inPassword = await request(app)
      .post('/api/auth/login')
      .send({ ...credentials, password: "' OR '1'='1" });

    expect(inEmail.status).toBe(400);
    expect(inPassword.status).toBe(401);
  });

  it('issues a new session id on every login (session fixation)', async () => {
    await registerUser();
    const agent = request.agent(app);

    const first = await agent.post('/api/auth/login').send(credentials);
    const second = await agent.post('/api/auth/login').send(credentials);

    expect(sessionCookie(second)).not.toBe(sessionCookie(first));
  });
});

describe('session lifecycle (US-02)', () => {
  it('answers 401 on a protected route without session [ST-03]', async () => {
    const res = await request(app).get('/api/auth/me');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('lets an authenticated user reach a protected route', async () => {
    await registerUser();
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send(credentials).expect(200);

    const res = await agent.get('/api/auth/me');

    expect(res.status).toBe(200);
    expect(res.body.email).toBe('ana@example.com');
  });

  it('destroys the session on the server when the user logs out', async () => {
    await registerUser();
    const agent = request.agent(app);
    const login = await agent.post('/api/auth/login').send(credentials);
    const oldCookie = sessionCookie(login);

    expect(await countSessions()).toBe(1);

    await agent.post('/api/auth/logout').expect(204);

    expect(await countSessions()).toBe(0);

    const replay = await request(app)
      .get('/api/auth/me')
      .set('Cookie', oldCookie);

    expect(replay.status).toBe(401);
  });

  it('answers 401 when logging out without a session', async () => {
    const res = await request(app).post('/api/auth/logout');

    expect(res.status).toBe(401);
  });

  it('answers 401 when the user of the session no longer exists', async () => {
    await registerUser();
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send(credentials).expect(200);

    await pool.query('DELETE FROM users');

    const res = await agent.get('/api/auth/me');

    expect(res.status).toBe(401);
  });
});
