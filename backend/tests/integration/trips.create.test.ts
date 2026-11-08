import request from 'supertest';
import { describe, expect, it } from 'vitest';
import app from '../../src/app.js';
import { pool } from '../../src/config/db.js';
import { createTripService } from '../../src/services/trip.service.js';
import { buildUser, loginAs } from '../helpers/auth.js';

const validTrip = {
  name: 'Paris',
  destination: 'Paris, France',
  startDate: '2026-12-01',
  endDate: '2026-12-05',
  type: 'collaborative',
};

async function countRows(table: 'trips' | 'trip_members'): Promise<number> {
  const { rows } = await pool.query<{ total: number }>(
    `SELECT count(*)::int AS total FROM ${table}`,
  );

  return rows[0].total;
}

describe('POST /api/trips (US-03)', () => {
  it('creates a collaborative trip and makes the user its organizer', async () => {
    const agent = await loginAs();

    const res = await agent.post('/api/trips').send(validTrip);

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      id: expect.any(String),
      name: 'Paris',
      destination: 'Paris, France',
      startDate: '2026-12-01',
      endDate: '2026-12-05',
      type: 'collaborative',
      maxMembers: 15,
      role: 'organizer',
    });

    const { rows } = await pool.query<{ role: string; email: string }>(
      `SELECT m.role, u.email
         FROM trip_members m JOIN users u ON u.id = m.user_id
        WHERE m.trip_id = $1`,
      [res.body.id],
    );

    expect(rows).toEqual([{ role: 'organizer', email: 'ana@example.com' }]);
  });

  it('creates a solo trip with the user as its only member', async () => {
    const agent = await loginAs();

    const res = await agent
      .post('/api/trips')
      .send({ ...validTrip, type: 'solo' });

    expect(res.status).toBe(201);
    expect(res.body.type).toBe('solo');
    expect(res.body.maxMembers).toBe(1);
    expect(await countRows('trip_members')).toBe(1);
  });

  it('accepts a trip that starts and ends on the same day', async () => {
    const agent = await loginAs();

    const res = await agent
      .post('/api/trips')
      .send({ ...validTrip, endDate: validTrip.startDate });

    expect(res.status).toBe(201);
  });

  it('takes the organizer and the member limit from the server, not the body', async () => {
    const agent = await loginAs();
    const other = await loginAs(
      buildUser({ name: 'Luis', email: 'luis@example.com' }),
    );
    const luis = await other.get('/api/auth/me');

    const res = await agent.post('/api/trips').send({
      ...validTrip,
      userId: luis.body.id,
      role: 'member',
      maxMembers: 999,
    });

    expect(res.status).toBe(201);
    expect(res.body.role).toBe('organizer');
    expect(res.body.maxMembers).toBe(15);

    const { rows } = await pool.query<{ email: string }>(
      `SELECT u.email FROM trip_members m JOIN users u ON u.id = m.user_id
        WHERE m.trip_id = $1`,
      [res.body.id],
    );

    expect(rows).toEqual([{ email: 'ana@example.com' }]);
  });

  it('answers 401 without a session and creates nothing [ST-03]', async () => {
    const res = await request(app).post('/api/trips').send(validTrip);

    expect(res.status).toBe(401);
    expect(await countRows('trips')).toBe(0);
  });

  it('checks the session before the body (401 beats 400)', async () => {
    const res = await request(app).post('/api/trips').send({});

    expect(res.status).toBe(401);
  });

  it.each([
    ['a missing name', { ...validTrip, name: undefined }, 'name'],
    ['an empty name', { ...validTrip, name: '' }, 'name'],
    [
      'a name over 100 characters',
      { ...validTrip, name: 'a'.repeat(101) },
      'name',
    ],
    [
      'a missing destination',
      { ...validTrip, destination: undefined },
      'destination',
    ],
    [
      'a date with the wrong format',
      { ...validTrip, startDate: '01/12/2026' },
      'startDate',
    ],
    [
      'a date that does not exist',
      { ...validTrip, endDate: '2026-02-30' },
      'endDate',
    ],
    [
      'an end date before the start date',
      { ...validTrip, endDate: '2026-11-30' },
      'endDate',
    ],
    ['an unknown type', { ...validTrip, type: 'group' }, 'type'],
    ['a missing type', { ...validTrip, type: undefined }, 'type'],
  ])('rejects %s with 400 and names the field', async (_label, body, field) => {
    const agent = await loginAs();

    const res = await agent.post('/api/trips').send(body);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(
      res.body.error.details.some(
        (detail: { field: string }) => detail.field === field,
      ),
    ).toBe(true);
    expect(await countRows('trips')).toBe(0);
  });

  it('treats SQL injection strings as plain text [ST-12]', async () => {
    const agent = await loginAs();
    const name = "Trip'); DROP TABLE trips;--";

    const res = await agent.post('/api/trips').send({ ...validTrip, name });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe(name);
    expect(await countRows('trips')).toBe(1);
  });

  it('creates nothing when the session user no longer exists (atomicity)', async () => {
    const agent = await loginAs();
    await pool.query('DELETE FROM users');

    const res = await agent.post('/api/trips').send(validTrip);

    expect(res.status).toBe(401);
    expect(await countRows('trips')).toBe(0);
    expect(await countRows('trip_members')).toBe(0);
  });

  it('lets the database enforce a single organizer per trip [BR-01]', async () => {
    const agent = await loginAs();
    const created = await agent.post('/api/trips').send(validTrip);

    await loginAs(buildUser({ name: 'Luis', email: 'luis@example.com' }));
    const { rows } = await pool.query<{ id: string }>(
      'SELECT id FROM users WHERE email = $1',
      ['luis@example.com'],
    );

    await expect(
      pool.query(
        `INSERT INTO trip_members (trip_id, user_id, role)
         VALUES ($1, $2, 'organizer')`,
        [created.body.id, rows[0].id],
      ),
    ).rejects.toMatchObject({ code: '23505' });
  });
});

describe('trip service', () => {
  it('rethrows unexpected database errors', async () => {
    const service = createTripService({
      tripModel: {
        createWithOrganizer: async () => {
          throw new Error('database is down');
        },
        listForUser: async () => [],
      },
    });

    await expect(
      service.createTrip('some-user-id', {
        name: 'Paris',
        destination: 'Paris',
        startDate: '2026-12-01',
        endDate: '2026-12-05',
        type: 'collaborative',
      }),
    ).rejects.toThrow('database is down');
  });
});
