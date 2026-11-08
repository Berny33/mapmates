import request from 'supertest';
import { describe, expect, it } from 'vitest';
import app from '../../src/app.js';
import { pool } from '../../src/config/db.js';
import { buildUser, loginAs } from '../helpers/auth.js';
import { createTrip } from '../helpers/trips.js';

const luisUser = buildUser({ name: 'Luis', email: 'luis@example.com' });

function names(body: { name: string }[]): string[] {
  return body.map((trip) => trip.name);
}

describe('GET /api/trips (US-04)', () => {
  it('lists the trips of the user with their role and nothing else', async () => {
    const ana = await loginAs();
    const trip = await createTrip(ana, { name: 'Paris' });

    const res = await ana.get('/api/trips');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      {
        id: trip.id,
        name: 'Paris',
        destination: 'Paris, France',
        startDate: '2026-12-01',
        endDate: '2026-12-05',
        type: 'collaborative',
        maxMembers: 15,
        createdAt: expect.any(String),
        role: 'organizer',
      },
    ]);
  });

  it('answers an empty list when the user has no trips', async () => {
    const ana = await loginAs();

    const res = await ana.get('/api/trips');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('never shows trips of other users [ST-04]', async () => {
    const ana = await loginAs();
    const luis = await loginAs(luisUser);
    await createTrip(ana, { name: 'Paris' });
    const tokyo = await createTrip(luis, { name: 'Tokyo' });

    const res = await ana.get('/api/trips');

    expect(names(res.body)).toEqual(['Paris']);
    expect(JSON.stringify(res.body)).not.toContain(tokyo.id);
    expect(JSON.stringify(res.body)).not.toContain('luis@example.com');
  });

  it('includes trips where the user is a member, with the role member', async () => {
    const ana = await loginAs();
    const luis = await loginAs(luisUser);
    const tokyo = await createTrip(luis, { name: 'Tokyo' });
    const anaId = (await ana.get('/api/auth/me')).body.id;

    // Joining a trip arrives with US-06, so the membership is inserted directly.
    await pool.query(
      `INSERT INTO trip_members (trip_id, user_id, role)
       VALUES ($1, $2, 'member')`,
      [tokyo.id, anaId],
    );

    const res = await ana.get('/api/trips');

    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({ name: 'Tokyo', role: 'member' });
  });

  it('ignores a userId sent in the query string [ST-04]', async () => {
    const ana = await loginAs();
    const luis = await loginAs(luisUser);
    await createTrip(ana, { name: 'Paris' });
    await createTrip(luis, { name: 'Tokyo' });
    const luisId = (await luis.get('/api/auth/me')).body.id;

    const res = await ana.get('/api/trips').query({ userId: luisId });

    expect(res.status).toBe(200);
    expect(names(res.body)).toEqual(['Paris']);
  });

  it('orders the trips by start date, the nearest first', async () => {
    const ana = await loginAs();
    await createTrip(ana, {
      name: 'Later',
      startDate: '2027-03-01',
      endDate: '2027-03-05',
    });
    await createTrip(ana, { name: 'Sooner' });

    const res = await ana.get('/api/trips');

    expect(names(res.body)).toEqual(['Sooner', 'Later']);
  });

  it('answers 401 without a session [ST-03]', async () => {
    const res = await request(app).get('/api/trips');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });
});
