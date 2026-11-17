import { createHash, randomUUID } from 'node:crypto';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import app from '../../src/app.js';
import { pool } from '../../src/config/db.js';
import { buildUser, loginAs } from '../helpers/auth.js';
import { createTrip } from '../helpers/trips.js';

const invitationPath = (tripId: string) =>
  `/api/trips/${tripId}/invitation`;

describe('trip invitations (US-05)', () => {
  it('creates a random invitation and stores only its hash', async () => {
    const organizer = await loginAs();
    const trip = await createTrip(organizer);

    const response = await organizer.post(invitationPath(trip.id));

    expect(response.status).toBe(201);
    expect(response.body.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(new Date(response.body.expiresAt).getTime()).toBeGreaterThan(
      Date.now() + 6 * 24 * 60 * 60 * 1000,
    );
    expect(new Date(response.body.expiresAt).getTime()).toBeLessThanOrEqual(
      Date.now() + 7 * 24 * 60 * 60 * 1000,
    );

    const { rows } = await pool.query<{ token_hash: string }>(
      'SELECT token_hash FROM invitations WHERE trip_id = $1',
      [trip.id],
    );

    expect(rows).toEqual([
      {
        token_hash: createHash('sha256')
          .update(response.body.token)
          .digest('hex'),
      },
    ]);
    expect(rows[0].token_hash).not.toBe(response.body.token);
  });

  it('reports whether an active invitation exists without revealing its token', async () => {
    const organizer = await loginAs();
    const trip = await createTrip(organizer);

    const emptyStatus = await organizer.get(invitationPath(trip.id));
    expect(emptyStatus.status).toBe(200);
    expect(emptyStatus.body).toEqual({ active: false, expiresAt: null });

    await organizer.post(invitationPath(trip.id)).expect(201);

    const activeStatus = await organizer.get(invitationPath(trip.id));
    expect(activeStatus.status).toBe(200);
    expect(activeStatus.body).toMatchObject({
      active: true,
      expiresAt: expect.any(String),
    });
    expect(activeStatus.body).not.toHaveProperty('token');
  });

  it('regenerates the invitation and invalidates the previous token [BR-07]', async () => {
    const organizer = await loginAs();
    const trip = await createTrip(organizer);
    const first = await organizer.post(invitationPath(trip.id)).expect(201);
    const second = await organizer.post(invitationPath(trip.id)).expect(201);

    expect(second.body.token).not.toBe(first.body.token);

    const { rows } = await pool.query<{
      token_hash: string;
      revoked_at: Date | null;
    }>(
      `SELECT token_hash, revoked_at
         FROM invitations
        WHERE trip_id = $1
        ORDER BY created_at, id`,
      [trip.id],
    );

    expect(rows).toHaveLength(2);
    expect(rows[0].token_hash).toBe(
      createHash('sha256').update(first.body.token).digest('hex'),
    );
    expect(rows[0].revoked_at).toBeInstanceOf(Date);
    expect(rows[1].token_hash).toBe(
      createHash('sha256').update(second.body.token).digest('hex'),
    );
    expect(rows[1].revoked_at).toBeNull();
  });

  it('revokes an active invitation immediately and is safe to repeat', async () => {
    const organizer = await loginAs();
    const trip = await createTrip(organizer);
    await organizer.post(invitationPath(trip.id)).expect(201);

    await organizer.delete(invitationPath(trip.id)).expect(204);
    await organizer.delete(invitationPath(trip.id)).expect(204);

    const status = await organizer.get(invitationPath(trip.id));
    expect(status.body).toEqual({ active: false, expiresAt: null });

    const { rows } = await pool.query<{ revoked_at: Date | null }>(
      'SELECT revoked_at FROM invitations WHERE trip_id = $1',
      [trip.id],
    );
    expect(rows[0].revoked_at).toBeInstanceOf(Date);
  });

  it('treats an expired invitation as inactive', async () => {
    const organizer = await loginAs();
    const trip = await createTrip(organizer);
    await organizer.post(invitationPath(trip.id)).expect(201);

    await pool.query(
      'UPDATE invitations SET expires_at = now() - interval \'1 second\' WHERE trip_id = $1',
      [trip.id],
    );

    const status = await organizer.get(invitationPath(trip.id));
    expect(status.body).toEqual({ active: false, expiresAt: null });
  });

  it('rejects invitation management by a trip member [ST-08]', async () => {
    const organizer = await loginAs();
    const member = await loginAs(
      buildUser({ name: 'Luis', email: 'luis@example.com' }),
    );
    const trip = await createTrip(organizer);
    const memberId = (await member.get('/api/auth/me')).body.id;

    await pool.query(
      `INSERT INTO trip_members (trip_id, user_id, role)
       VALUES ($1, $2, 'member')`,
      [trip.id, memberId],
    );

    await member.get(invitationPath(trip.id)).expect(403);
    await member.post(invitationPath(trip.id)).expect(403);
    await member.delete(invitationPath(trip.id)).expect(403);
  });

  it('rejects invitation management for a solo trip with 409', async () => {
    const organizer = await loginAs();
    const trip = await createTrip(organizer, { type: 'solo' });

    await organizer.get(invitationPath(trip.id)).expect(409);
    await organizer.post(invitationPath(trip.id)).expect(409);
    await organizer.delete(invitationPath(trip.id)).expect(409);
  });

  it('returns 401 before validating invitation route parameters', async () => {
    const invalidPath = invitationPath('not-a-uuid');

    await request(app).get(invalidPath).expect(401);
    await request(app).post(invalidPath).expect(401);
    await request(app).delete(invalidPath).expect(401);
  });

  it('rejects malformed trip ids with 400', async () => {
    const organizer = await loginAs();
    const invalidPath = invitationPath('not-a-uuid');

    await organizer.get(invalidPath).expect(400);
    await organizer.post(invalidPath).expect(400);
    await organizer.delete(invalidPath).expect(400);
  });

  it('returns 404 when the trip does not exist', async () => {
    const organizer = await loginAs();
    const missingTripPath = invitationPath(randomUUID());

    await organizer.get(missingTripPath).expect(404);
    await organizer.post(missingTripPath).expect(404);
    await organizer.delete(missingTripPath).expect(404);
  });
});
