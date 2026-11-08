import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import app from '../../src/app.js';
import { sessionMiddleware } from '../../src/config/session.js';
import { errorHandler, notFound } from '../../src/middlewares/errorHandler.js';
import { createRateLimiter } from '../../src/middlewares/rateLimit.js';
import { requireAuth } from '../../src/middlewares/requireAuth.js';
import { validate } from '../../src/middlewares/validate.js';

function buildTestApp() {
  const testApp = express();

  testApp.use(express.json());
  testApp.use(sessionMiddleware);

  testApp.post(
    '/validate',
    validate(z.object({ name: z.string().min(1) })),
    (req, res) => {
      res.status(200).json(req.body);
    },
  );
  testApp.post('/fake-login', (req, res) => {
    req.session.userId = 'test-user-id';
    res.status(204).end();
  });
  testApp.get('/private', requireAuth, (_req, res) => {
    res.status(200).json({ ok: true });
  });
  testApp.get('/boom', () => {
    throw new Error('secret internal detail');
  });
  testApp.get(
    '/limited',
    createRateLimiter({ windowMs: 60_000, limit: 2 }),
    (_req, res) => {
      res.status(200).json({ ok: true });
    },
  );
  testApp.get(
    '/search',
    validate(z.object({ page: z.string().regex(/^\d+$/) }), 'query'),
    (_req, res) => {
      res.status(200).json({ ok: true });
    },
  );

  testApp.use(notFound);
  testApp.use(errorHandler);

  return testApp;
}

describe('validate', () => {
  it('passes valid data to the handler', async () => {
    const res = await request(buildTestApp())
      .post('/validate')
      .send({ name: 'Ana' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ name: 'Ana' });
  });

  it('rejects invalid data with 400 and names the invalid field', async () => {
    const res = await request(buildTestApp())
      .post('/validate')
      .send({ name: '' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details[0].field).toBe('name');
  });

  it('rejects a request without body with 400', async () => {
    const res = await request(buildTestApp()).post('/validate');

    expect(res.status).toBe(400);
  });
});

describe('validate (query string)', () => {
  it('accepts a valid query', async () => {
    const res = await request(buildTestApp()).get('/search?page=2');

    expect(res.status).toBe(200);
  });

  it('rejects an invalid query with 400 and names the field', async () => {
    const res = await request(buildTestApp()).get('/search?page=abc');

    expect(res.status).toBe(400);
    expect(res.body.error.details[0].field).toBe('page');
  });
});

describe('requireAuth [ST-03]', () => {
  it('answers 401 when there is no session', async () => {
    const res = await request(buildTestApp()).get('/private');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('lets an authenticated session through', async () => {
    const agent = request.agent(buildTestApp());
    await agent.post('/fake-login').expect(204);

    const res = await agent.get('/private');

    expect(res.status).toBe(200);
  });
});

describe('session cookie', () => {
  it('is httpOnly and SameSite=Lax', async () => {
    const res = await request(buildTestApp()).post('/fake-login');
    const cookie = String(res.headers['set-cookie']);

    expect(cookie).toContain('mapmates.sid');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
  });
});

describe('errorHandler', () => {
  it('answers 404 with the common error format', async () => {
    const res = await request(buildTestApp()).get('/does-not-exist');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('hides internal details of unexpected errors', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await request(buildTestApp()).get('/boom');
    spy.mockRestore();

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
    expect(JSON.stringify(res.body)).not.toContain('secret internal detail');
  });

  it('answers 400 to malformed JSON', async () => {
    const res = await request(buildTestApp())
      .post('/validate')
      .set('Content-Type', 'application/json')
      .send('{"name":');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });
});

describe('rate limiter [ST-21]', () => {
  it('answers 429 after the limit is exceeded', async () => {
    const testApp = buildTestApp();

    await request(testApp).get('/limited').expect(200);
    await request(testApp).get('/limited').expect(200);
    const res = await request(testApp).get('/limited');

    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('TOO_MANY_REQUESTS');
  });
});

describe('application defaults', () => {
  it('sends security headers (helmet)', async () => {
    const res = await request(app).get('/api/health');

    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('rejects a body larger than 10 KB with 413', async () => {
    const res = await request(app)
      .post('/api/health')
      .send({ data: 'x'.repeat(11_000) });

    expect(res.status).toBe(413);
  });

  it('answers unknown API routes with a JSON 404', async () => {
    const res = await request(app).get('/api/unknown');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
