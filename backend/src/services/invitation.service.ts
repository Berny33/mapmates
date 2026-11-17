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
  };
}

export type InvitationService = ReturnType<typeof createInvitationService>;
