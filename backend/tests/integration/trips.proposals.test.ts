import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import app from '../../src/app.js';
import { pool } from '../../src/config/db.js';
import { buildUser, loginAs } from '../helpers/auth.js';
import { createTrip } from '../helpers/trips.js';

const proposalPath = (tripId: string) => `/api/trips/${tripId}/proposals`;
const proposalVotePath = (tripId: string, proposalId: string) =>
  `${proposalPath(tripId)}/${proposalId}/vote`;

const validProposal = {
  placeName: 'Louvre Museum',
  latitude: 48.8606,
  longitude: 2.3376,
  category: 'culture',
  day: '2026-12-02',
  startTime: '10:00',
  endTime: '12:00',
  note: 'Visit the permanent collection',
  votingDurationHours: 24,
};

describe('trip proposals (US-08)', () => {
  it('creates an open collaborative proposal with a voting deadline [BR-15]', async () => {
    const member = await loginAs();
    const trip = await createTrip(member);

    const response = await member
      .post(proposalPath(trip.id))
      .send({ ...validProposal, authorId: randomUUID() })
      .expect(201);

    expect(response.body).toMatchObject({
      tripId: trip.id,
      placeName: 'Louvre Museum',
      latitude: 48.8606,
      longitude: 2.3376,
      category: 'culture',
      day: '2026-12-02',
      startTime: '10:00',
      endTime: '12:00',
      note: 'Visit the permanent collection',
      status: 'open',
    });
    expect(response.body.votingDeadline).toEqual(expect.any(String));
    expect(new Date(response.body.votingDeadline).getTime()).toBeGreaterThan(
      Date.now() + 23 * 60 * 60 * 1000,
    );

    const { rows } = await pool.query<{ author_id: string }>(
      'SELECT author_id FROM proposals WHERE id = $1',
      [response.body.id],
    );
    expect(rows[0].author_id).toBe((await member.get('/api/auth/me')).body.id);
  });

  it('creates a solo proposal as approved [FR-13]', async () => {
    const organizer = await loginAs();
    const trip = await createTrip(organizer, { type: 'solo' });

    const response = await organizer
      .post(proposalPath(trip.id))
      .send(validProposal)
      .expect(201);

    expect(response.body.status).toBe('approved');
    const itinerary = await organizer
      .get(`/api/trips/${trip.id}/itinerary`)
      .expect(200);
    expect(itinerary.body).toContainEqual(
      expect.objectContaining({
        id: response.body.id,
        placeName: 'Louvre Museum',
        status: 'approved',
      }),
    );
  });

  it('lists only approved activities and restricts itinerary access [ST-04]', async () => {
    const organizer = await loginAs();
    const member = await loginAs(
      buildUser({ name: 'Luis', email: 'luis@example.com' }),
    );
    const trip = await createTrip(organizer);
    await organizer.post(proposalPath(trip.id)).send(validProposal).expect(201);

    await organizer.get(`/api/trips/${trip.id}/itinerary`).expect(200, []);
    await request(app).get(`/api/trips/${trip.id}/itinerary`).expect(401);
    await member.get(`/api/trips/${trip.id}/itinerary`).expect(403);
    await organizer.get(`/api/trips/${randomUUID()}/itinerary`).expect(404);
  });

  it('allows open proposals to overlap but rejects overlaps with approved activities [BR-10, ST-17]', async () => {
    const member = await loginAs();
    const collaborativeTrip = await createTrip(member);

    await member
      .post(proposalPath(collaborativeTrip.id))
      .send(validProposal)
      .expect(201);
    await member
      .post(proposalPath(collaborativeTrip.id))
      .send({ ...validProposal, placeName: 'Second museum' })
      .expect(201);

    const soloTrip = await createTrip(member, {
      name: 'Solo Paris',
      type: 'solo',
    });
    await member
      .post(proposalPath(soloTrip.id))
      .send(validProposal)
      .expect(201);

    await member
      .post(proposalPath(soloTrip.id))
      .send({
        ...validProposal,
        placeName: 'Overlapping activity',
        startTime: '11:00',
      })
      .expect(409);

    await member
      .post(proposalPath(soloTrip.id))
      .send({
        ...validProposal,
        placeName: 'Adjacent activity',
        startTime: '12:00',
        endTime: '13:00',
      })
      .expect(201);
  });

  it('prevents concurrent approved activities from overlapping [BR-10, ST-17]', async () => {
    const organizer = await loginAs();
    const trip = await createTrip(organizer, { type: 'solo' });

    const responses = await Promise.all([
      organizer.post(proposalPath(trip.id)).send(validProposal),
      organizer
        .post(proposalPath(trip.id))
        .send({ ...validProposal, placeName: 'Concurrent activity' }),
    ]);

    expect(responses.map((response) => response.status).sort()).toEqual([
      201, 409,
    ]);
  });

  it('rejects invalid proposal fields [BR-06, BR-09, BR-14, BR-15, ST-14, ST-15, ST-16]', async () => {
    const member = await loginAs();
    const trip = await createTrip(member);
    const invalidProposals = [
      { ...validProposal, category: 'invalid-category' },
      { ...validProposal, day: '2026-11-30' },
      { ...validProposal, startTime: '12:00', endTime: '12:00' },
      { ...validProposal, note: 'x'.repeat(281) },
      { ...validProposal, votingDurationHours: 0 },
      { ...validProposal, votingDurationHours: 73 },
    ];

    for (const proposal of invalidProposals) {
      await member.post(proposalPath(trip.id)).send(proposal).expect(400);
    }
  });

  it('returns 401 before validation and checks membership and trip existence [ST-03, ST-04, ST-09]', async () => {
    const invalidPath = proposalPath('not-a-uuid');
    await request(app).post(invalidPath).send({}).expect(401);

    const member = await loginAs();
    await member.post(invalidPath).send({}).expect(400);

    const organizer = await loginAs(
      buildUser({ name: 'Luis', email: 'luis@example.com' }),
    );
    const trip = await createTrip(organizer);

    await member.post(proposalPath(trip.id)).send(validProposal).expect(403);
    await member
      .post(proposalPath(randomUUID()))
      .send(validProposal)
      .expect(404);
  });

  it('authenticates and validates place searches without calling Nominatim for invalid input', async () => {
    await request(app).get('/api/places/search?q=Paris').expect(401);

    const member = await loginAs();
    await member.get('/api/places/search?q=a').expect(400);

    vi.stubEnv('GEOCODING_USER_AGENT', 'MapMates/1.0 (contact@example.com)');
    vi.stubGlobal(
      'fetch',
      async () =>
        new Response(
          JSON.stringify([
            {
              name: 'Eiffel Tower',
              display_name: 'Eiffel Tower, Paris, France',
              lat: '48.8584',
              lon: '2.2945',
            },
          ]),
          { status: 200 },
        ),
    );

    try {
      await member.get('/api/places/search?q=Eiffel').expect(200, [
        {
          placeName: 'Eiffel Tower',
          latitude: 48.8584,
          longitude: 2.2945,
        },
      ]);
    } finally {
      vi.unstubAllGlobals();
      vi.unstubAllEnvs();
    }
  });
});

describe('proposal voting (US-09)', () => {
  it('records, changes, and withdraws a vote while voting is open [BR-02]', async () => {
    const member = await loginAs();
    const trip = await createTrip(member);
    const proposal = await member
      .post(proposalPath(trip.id))
      .send(validProposal)
      .expect(201);
    const path = proposalVotePath(trip.id, proposal.body.id);

    await member
      .post(path)
      .send({ value: 'for' })
      .expect(200, {
        proposalId: proposal.body.id,
        forVotes: 1,
        againstVotes: 0,
        userVote: 'for',
      });

    await member
      .post(path)
      .send({ value: 'against' })
      .expect(200, {
        proposalId: proposal.body.id,
        forVotes: 0,
        againstVotes: 1,
        userVote: 'against',
      });

    await member
      .post(path)
      .send({ value: 'against' })
      .expect(200, {
        proposalId: proposal.body.id,
        forVotes: 0,
        againstVotes: 0,
        userVote: null,
      });

    const { rows } = await pool.query<{ count: number }>(
      'SELECT count(*)::int AS count FROM proposal_votes WHERE proposal_id = $1',
      [proposal.body.id],
    );
    expect(rows[0].count).toBe(0);
  });

  it('lists proposals with vote counts and the current member vote', async () => {
    const organizer = await loginAs();
    const member = await loginAs(
      buildUser({ name: 'Luis', email: 'luis@example.com' }),
    );
    const trip = await createTrip(organizer);
    const proposal = await organizer
      .post(proposalPath(trip.id))
      .send(validProposal)
      .expect(201);
    const closedProposal = await organizer
      .post(proposalPath(trip.id))
      .send({ ...validProposal, placeName: 'Closed proposal' })
      .expect(201);
    await pool.query("UPDATE proposals SET status = 'rejected' WHERE id = $1", [
      closedProposal.body.id,
    ]);

    await organizer
      .post(proposalVotePath(trip.id, proposal.body.id))
      .send({ value: 'for' })
      .expect(200);

    const response = await organizer
      .get(proposalPath(trip.id))
      .expect(200);
    expect(response.body).toHaveLength(2);
    expect(response.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: proposal.body.id,
          placeName: 'Louvre Museum',
          status: 'open',
          forVotes: 1,
          againstVotes: 0,
          userVote: 'for',
        }),
        expect.objectContaining({
          id: closedProposal.body.id,
          status: 'rejected',
          forVotes: 0,
          againstVotes: 0,
          userVote: null,
        }),
      ]),
    );

    await request(app).get(proposalPath(trip.id)).expect(401);
    await member.get(proposalPath(trip.id)).expect(403);
    await organizer.get(proposalPath('not-a-uuid')).expect(400);
    await organizer.get(proposalPath(randomUUID())).expect(404);
  });

  it('closes overdue proposals on read and resolves votes and schedule conflicts [BR-03, BR-04, BR-11]', async () => {
    const member = await loginAs();
    const trip = await createTrip(member);
    const createOpenProposal = async (
      placeName: string,
      overrides: Record<string, unknown> = {},
    ) =>
      member
        .post(proposalPath(trip.id))
        .send({ ...validProposal, placeName, ...overrides })
        .expect(201);

    const tiedProposal = await createOpenProposal('Tied proposal');
    const approvedProposal = await createOpenProposal('Approved proposal', {
      startTime: '13:00',
      endTime: '14:00',
    });
    const rejectedProposal = await createOpenProposal('Rejected proposal', {
      startTime: '15:00',
      endTime: '16:00',
    });
    const existingApproved = await createOpenProposal('Existing activity');
    const conflictProposal = await createOpenProposal('Conflicting winner');

    await pool.query(
      "UPDATE proposals SET status = 'approved' WHERE id = $1",
      [existingApproved.body.id],
    );
    await member
      .post(proposalVotePath(trip.id, approvedProposal.body.id))
      .send({ value: 'for' })
      .expect(200);
    await member
      .post(proposalVotePath(trip.id, rejectedProposal.body.id))
      .send({ value: 'against' })
      .expect(200);
    await member
      .post(proposalVotePath(trip.id, conflictProposal.body.id))
      .send({ value: 'for' })
      .expect(200);

    await pool.query(
      `UPDATE proposals
          SET voting_deadline = now() - interval '1 minute'
        WHERE id = ANY($1::uuid[])`,
      [[
        tiedProposal.body.id,
        approvedProposal.body.id,
        rejectedProposal.body.id,
        conflictProposal.body.id,
      ]],
    );

    const response = await member.get(proposalPath(trip.id)).expect(200);
    const proposalsById = new Map<string, string>();
    for (const proposal of response.body as Array<{
      id: string;
      status: string;
    }>) {
      proposalsById.set(proposal.id, proposal.status);
    }

    expect(proposalsById.get(tiedProposal.body.id)).toBe('tied');
    expect(proposalsById.get(approvedProposal.body.id)).toBe('approved');
    expect(proposalsById.get(rejectedProposal.body.id)).toBe('rejected');
    expect(proposalsById.get(conflictProposal.body.id)).toBe(
      'rejected_conflict',
    );
    expect(
      response.body.find(
        (proposal: { id: string }) => proposal.id === tiedProposal.body.id,
      ).votingDeadline,
    ).toEqual(expect.any(String));

    const itinerary = await member
      .get(`/api/trips/${trip.id}/itinerary`)
      .expect(200);
    expect(itinerary.body).toContainEqual(
      expect.objectContaining({ id: approvedProposal.body.id }),
    );
    expect(itinerary.body).not.toContainEqual(
      expect.objectContaining({ id: conflictProposal.body.id }),
    );
  });

  it('validates vote values and checks membership and proposal existence [ST-03, ST-04, ST-09]', async () => {
    const organizer = await loginAs();
    const outsider = await loginAs(
      buildUser({ name: 'Luis', email: 'luis@example.com' }),
    );
    const trip = await createTrip(organizer);
    const proposal = await organizer
      .post(proposalPath(trip.id))
      .send(validProposal)
      .expect(201);

    await request(app)
      .post(proposalVotePath(trip.id, proposal.body.id))
      .send({})
      .expect(401);
    await organizer
      .post(proposalVotePath(trip.id, proposal.body.id))
      .send({ value: 'abstain' })
      .expect(400);
    await organizer
      .post(proposalVotePath(trip.id, 'not-a-uuid'))
      .send({ value: 'for' })
      .expect(400);
    await outsider
      .post(proposalVotePath(trip.id, proposal.body.id))
      .send({ value: 'for' })
      .expect(403);
    await organizer
      .post(proposalVotePath(trip.id, randomUUID()))
      .send({ value: 'for' })
      .expect(404);
  });

  it('rejects votes on closed or expired proposals [BR-03, ST-18]', async () => {
    const member = await loginAs();
    const trip = await createTrip(member);
    const closedProposal = await member
      .post(proposalPath(trip.id))
      .send(validProposal)
      .expect(201);
    await pool.query("UPDATE proposals SET status = 'rejected' WHERE id = $1", [
      closedProposal.body.id,
    ]);

    await member
      .post(proposalVotePath(trip.id, closedProposal.body.id))
      .send({ value: 'for' })
      .expect(409);

    const expiredProposal = await member
      .post(proposalPath(trip.id))
      .send({ ...validProposal, placeName: 'Expired proposal' })
      .expect(201);
    await pool.query(
      `UPDATE proposals
          SET voting_deadline = now() - interval '1 minute'
        WHERE id = $1`,
      [expiredProposal.body.id],
    );

    await member
      .post(proposalVotePath(trip.id, expiredProposal.body.id))
      .send({ value: 'for' })
      .expect(409);
  });
});
