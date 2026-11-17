import { createHash, randomBytes } from 'node:crypto';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import app from '../../src/app.js';
import { pool } from '../../src/config/db.js';
import { buildUser, loginAs } from '../helpers/auth.js';
import { createTrip } from '../helpers/trips.js';

const invitationPath = (tripId: string) =>
  `/api/trips/${tripId}/invitation`;
const previewPath = (token: string) =>
  `/api/invitations/${encodeURIComponent(token)}`;
const joinPath = (token: string) =>
  `/api/invitations/${encodeURIComponent(token)}/join`;

describe('joining trips with invitation links (US-06)', () => {
  it('shows essential trip details before the user confirms joining', async () => {
    const organizer = await loginAs();
    const member = await loginAs(
      buildUser({ name: 'Luis', email: 'luis@example.com' }),
    );
    const trip = await createTrip(organizer);
    const invitation = await organizer
      .post(invitationPath(trip.id))
      .expect(201);

    await member.get(previewPath(invitation.body.token)).expect(200, {
      name: trip.name,
      destination: 'Paris, France',
      startDate: '2026-12-01',
      endDate: '2026-12-05',
      type: 'collaborative',
    });

    const trips = await member.get('/api/trips').expect(200);
    expect(trips.body).not.toContainEqual(
      expect.objectContaining({ id: trip.id }),
    );
  });

  it('adds the authenticated user as a member [BR-07, BR-08]', async () => {
    const organizer = await loginAs();
    const member = await loginAs(
      buildUser({ name: 'Luis', email: 'luis@example.com' }),
    );
    const trip = await createTrip(organizer);
    const invitation = await organizer
      .post(invitationPath(trip.id))
      .expect(201);

    await member
      .post(joinPath(invitation.body.token))
      .expect(200, { joined: true });

    const memberId = (await member.get('/api/auth/me')).body.id;
    const { rows } = await pool.query<{ role: string }>(
      `SELECT role
         FROM trip_members
        WHERE trip_id = $1
          AND user_id = $2`,
      [trip.id, memberId],
    );
    expect(rows).toEqual([{ role: 'member' }]);

    const trips = await member.get('/api/trips').expect(200);
    expect(trips.body).toContainEqual(
      expect.objectContaining({ id: trip.id, role: 'member' }),
    );
  });

  it('does not duplicate membership when the user is already a member', async () => {
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
    const invitation = await organizer
      .post(invitationPath(trip.id))
      .expect(201);

    await member
      .post(joinPath(invitation.body.token))
      .expect(200, { joined: false });

    const { rows } = await pool.query<{ count: number }>(
      `SELECT count(*)::int AS count
         FROM trip_members
        WHERE trip_id = $1
          AND user_id = $2`,
      [trip.id, memberId],
    );
    expect(rows[0].count).toBe(1);
  });

  it('returns the same 404 for nonexistent, expired and revoked tokens', async () => {
    const organizer = await loginAs();
    const member = await loginAs(
      buildUser({ name: 'Luis', email: 'luis@example.com' }),
    );
    const trip = await createTrip(organizer);

    const expired = await organizer
      .post(invitationPath(trip.id))
      .expect(201);
    await pool.query(
      `UPDATE invitations
          SET expires_at = now() - interval '1 second'
        WHERE token_hash = $1`,
      [createHash('sha256').update(expired.body.token).digest('hex')],
    );

    const revoked = await organizer
      .post(invitationPath(trip.id))
      .expect(201);
    await organizer.delete(invitationPath(trip.id)).expect(204);

    const tokens = [
      randomBytes(32).toString('base64url'),
      expired.body.token,
      revoked.body.token,
    ];
    const responses = await Promise.all(
      tokens.map((token) => member.post(joinPath(token))),
    );
    const previews = await Promise.all(
      tokens.map((token) => member.get(previewPath(token))),
    );

    responses.forEach((response) => expect(response.status).toBe(404));
    expect(responses[1].body).toEqual(responses[0].body);
    expect(responses[2].body).toEqual(responses[0].body);
    previews.forEach((response) => expect(response.status).toBe(404));
    expect(previews[1].body).toEqual(previews[0].body);
    expect(previews[2].body).toEqual(previews[0].body);
  });

  it('rejects joins when the trip is full but keeps existing membership idempotent', async () => {
    const organizer = await loginAs();
    const member = await loginAs(
      buildUser({ name: 'Luis', email: 'luis@example.com' }),
    );
    const outsider = await loginAs(
      buildUser({ name: 'Maria', email: 'maria@example.com' }),
    );
    const trip = await createTrip(organizer);
    const memberId = (await member.get('/api/auth/me')).body.id;

    await pool.query(
      `INSERT INTO trip_members (trip_id, user_id, role)
       VALUES ($1, $2, 'member')`,
      [trip.id, memberId],
    );
    await pool.query(
      `INSERT INTO users (name, email, password_hash)
       SELECT 'Capacity member', 'capacity-' || number || '@example.com', 'unused-test-hash'
         FROM generate_series(1, 13) AS member_number(number)`,
    );
    await pool.query(
      `INSERT INTO trip_members (trip_id, user_id, role)
       SELECT $1, id, 'member'
         FROM users
        WHERE email LIKE 'capacity-%@example.com'`,
      [trip.id],
    );

    const invitation = await organizer
      .post(invitationPath(trip.id))
      .expect(201);

    await member
      .post(joinPath(invitation.body.token))
      .expect(200, { joined: false });
    await outsider.post(joinPath(invitation.body.token)).expect(409);
  });

  it('returns 401 before validating the token and rejects malformed tokens [ST-23]', async () => {
    await request(app).get(previewPath('malformed')).expect(401);
    await request(app).post(joinPath('malformed')).expect(401);

    const member = await loginAs();
    await member.get(previewPath('malformed')).expect(400);
    await member.post(joinPath('malformed')).expect(400);
    await member.post(joinPath('a'.repeat(42))).expect(400);
  });
});
