import { createHash, randomBytes } from 'node:crypto';
import type { PoolClient } from 'pg';
import { pool } from '../config/db.js';
import { AppError } from '../utils/AppError.js';

const INVITATION_LIFETIME = '7 days';

interface TripInvitationAccess {
  type: string;
  role: string | null;
}

interface InvitationExpiryRow {
  expiresAt: Date;
}

interface InvitationStatusRow {
  expiresAt: Date;
}

interface InvitationTripRow {
  tripId: string;
}

interface InvitationPreviewRow {
  name: string;
  destination: string;
  startDate: string;
  endDate: string;
  type: string;
}

interface JoinTripRow {
  maxMembers: number;
}

interface MembershipRow {
  role: string;
}

interface MemberCountRow {
  count: number;
}

async function assertOrganizerOfCollaborativeTrip(
  client: PoolClient,
  userId: string,
  tripId: string,
): Promise<void> {
  const { rows } = await client.query<TripInvitationAccess>(
    `SELECT t.type, m.role
       FROM trips t
       LEFT JOIN trip_members m
         ON m.trip_id = t.id
        AND m.user_id = $2
      WHERE t.id = $1
      FOR UPDATE OF t`,
    [tripId, userId],
  );

  const trip = rows[0];
  if (!trip) {
    throw new AppError(404, 'NOT_FOUND', 'Trip not found');
  }

  if (trip.role !== 'organizer') {
    throw new AppError(403, 'FORBIDDEN', 'Only the trip organizer can manage invitations');
  }

  if (trip.type !== 'collaborative') {
    throw new AppError(
      409,
      'SOLO_TRIP_INVITATIONS_UNAVAILABLE',
      'Solo trips cannot have invitation links',
    );
  }
}

async function withOrganizerTrip<T>(
  userId: string,
  tripId: string,
  operation: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await assertOrganizerOfCollaborativeTrip(client, userId, tripId);
    const result = await operation(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export const invitationModel = {
  async findPreviewForActiveToken(
    client: PoolClient,
    tokenHash: string,
  ): Promise<InvitationPreviewRow | undefined> {
    const { rows } = await client.query<InvitationPreviewRow>(
      `SELECT t.name,
              t.destination,
              t.start_date::text AS "startDate",
              t.end_date::text AS "endDate",
              t.type
         FROM invitations i
         JOIN trips t ON t.id = i.trip_id
        WHERE i.token_hash = $1
          AND i.revoked_at IS NULL
          AND i.expires_at > now()`,
      [tokenHash],
    );

    return rows[0];
  },

  async findTripIdForActiveToken(
    client: PoolClient,
    tokenHash: string,
  ): Promise<InvitationTripRow | undefined> {
    const { rows } = await client.query<InvitationTripRow>(
      `SELECT trip_id AS "tripId"
         FROM invitations
        WHERE token_hash = $1
          AND revoked_at IS NULL
          AND expires_at > now()`,
      [tokenHash],
    );

    return rows[0];
  },

  async lockTrip(
    client: PoolClient,
    tripId: string,
  ): Promise<JoinTripRow | undefined> {
    const { rows } = await client.query<JoinTripRow>(
      `SELECT max_members AS "maxMembers"
         FROM trips
        WHERE id = $1
        FOR UPDATE`,
      [tripId],
    );

    return rows[0];
  },

  async confirmActiveTokenForTrip(
    client: PoolClient,
    tripId: string,
    tokenHash: string,
  ): Promise<boolean> {
    const { rowCount } = await client.query(
      `SELECT id
         FROM invitations
        WHERE trip_id = $1
          AND token_hash = $2
          AND revoked_at IS NULL
          AND expires_at > now()
        FOR UPDATE`,
      [tripId, tokenHash],
    );

    return rowCount === 1;
  },

  async findMembership(
    client: PoolClient,
    tripId: string,
    userId: string,
  ): Promise<MembershipRow | undefined> {
    const { rows } = await client.query<MembershipRow>(
      `SELECT role
         FROM trip_members
        WHERE trip_id = $1
          AND user_id = $2`,
      [tripId, userId],
    );

    return rows[0];
  },

  async countMembers(client: PoolClient, tripId: string): Promise<number> {
    const { rows } = await client.query<MemberCountRow>(
      `SELECT count(*)::int AS count
         FROM trip_members
        WHERE trip_id = $1`,
      [tripId],
    );

    return rows[0].count;
  },

  async addMember(
    client: PoolClient,
    tripId: string,
    userId: string,
  ): Promise<void> {
    await client.query(
      `INSERT INTO trip_members (trip_id, user_id, role)
       VALUES ($1, $2, 'member')`,
      [tripId, userId],
    );
  },

  async findActiveExpiry(
    client: PoolClient,
    tripId: string,
  ): Promise<InvitationStatusRow | undefined> {
    const { rows } = await client.query<InvitationStatusRow>(
      `SELECT expires_at AS "expiresAt"
         FROM invitations
        WHERE trip_id = $1
          AND revoked_at IS NULL
          AND expires_at > now()`,
      [tripId],
    );

    return rows[0];
  },

  async revokeUnrevoked(client: PoolClient, tripId: string): Promise<void> {
    await client.query(
      `UPDATE invitations
          SET revoked_at = now()
        WHERE trip_id = $1
          AND revoked_at IS NULL`,
      [tripId],
    );
  },

  async create(
    client: PoolClient,
    tripId: string,
    tokenHash: string,
  ): Promise<InvitationExpiryRow> {
    const { rows } = await client.query<InvitationExpiryRow>(
      `INSERT INTO invitations (trip_id, token_hash, expires_at)
       VALUES ($1, $2, now() + $3::interval)
       RETURNING expires_at AS "expiresAt"`,
      [tripId, tokenHash, INVITATION_LIFETIME],
    );

    return rows[0];
  },
};

interface InvitationServiceDependencies {
  invitationModel: typeof invitationModel;
}

export function createInvitationService({
  invitationModel,
}: InvitationServiceDependencies) {
  return {
    async getStatus(userId: string, tripId: string) {
      return withOrganizerTrip(userId, tripId, async (client) => {
        const invitation = await invitationModel.findActiveExpiry(client, tripId);

        return {
          active: Boolean(invitation),
          expiresAt: invitation?.expiresAt.toISOString() ?? null,
        };
      });
    },

    async generate(userId: string, tripId: string) {
      const token = randomBytes(32).toString('base64url');
      const tokenHash = hashToken(token);

      const invitation = await withOrganizerTrip(
        userId,
        tripId,
        async (client) => {
          await invitationModel.revokeUnrevoked(client, tripId);
          return invitationModel.create(client, tripId, tokenHash);
        },
      );

      return { token, expiresAt: invitation.expiresAt.toISOString() };
    },

    async revoke(userId: string, tripId: string): Promise<void> {
      await withOrganizerTrip(userId, tripId, (client) =>
        invitationModel.revokeUnrevoked(client, tripId),
      );
    },

    async preview(token: string): Promise<InvitationPreviewRow> {
      const client = await pool.connect();

      try {
        const trip = await invitationModel.findPreviewForActiveToken(
          client,
          hashToken(token),
        );
        if (!trip) {
          throw new AppError(404, 'NOT_FOUND', 'Invitation not found');
        }

        return trip;
      } finally {
        client.release();
      }
    },

    async join(userId: string, token: string): Promise<{ joined: boolean }> {
      const tokenHash = hashToken(token);
      const client = await pool.connect();

      try {
        await client.query('BEGIN');

        const invitation =
          await invitationModel.findTripIdForActiveToken(client, tokenHash);
        if (!invitation) {
          throw new AppError(404, 'NOT_FOUND', 'Invitation not found');
        }

        const trip = await invitationModel.lockTrip(client, invitation.tripId);
        if (!trip) {
          throw new AppError(404, 'NOT_FOUND', 'Invitation not found');
        }

        const isStillActive =
          await invitationModel.confirmActiveTokenForTrip(
            client,
            invitation.tripId,
            tokenHash,
          );
        if (!isStillActive) {
          throw new AppError(404, 'NOT_FOUND', 'Invitation not found');
        }

        const membership = await invitationModel.findMembership(
          client,
          invitation.tripId,
          userId,
        );
        if (membership) {
          await client.query('COMMIT');
          return { joined: false };
        }

        const memberCount = await invitationModel.countMembers(
          client,
          invitation.tripId,
        );
        if (memberCount >= trip.maxMembers) {
          throw new AppError(409, 'TRIP_FULL', 'Trip has reached its member limit');
        }

        await invitationModel.addMember(client, invitation.tripId, userId);
        await client.query('COMMIT');

        return { joined: true };
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
  };
}

export type InvitationService = ReturnType<typeof createInvitationService>;
