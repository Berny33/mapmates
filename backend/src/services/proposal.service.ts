import type { PoolClient } from 'pg';
import { pool } from '../config/db.js';
import type {
  NewProposal,
  Proposal,
  ProposalStatus,
} from '../models/proposal.model.js';
import { AppError } from '../utils/AppError.js';
import type { CreateProposalInput } from '../validators/proposal.validators.js';

interface ProposalTripRow {
  id: string;
  type: 'solo' | 'collaborative';
  startDate: string;
  endDate: string;
}

interface ProposalAccessRow {
  role: string | null;
}

interface TripRoleRow {
  role: string | null;
}

interface OverlapRow {
  overlaps: boolean;
}

const PROPOSAL_COLUMNS = `id,
  trip_id AS "tripId",
  author_id AS "authorId",
  place_name AS "placeName",
  lat::double precision AS latitude,
  lon::double precision AS longitude,
  category,
  day::text AS day,
  to_char(start_time, 'HH24:MI') AS "startTime",
  to_char(end_time, 'HH24:MI') AS "endTime",
  note,
  voting_deadline AS "votingDeadline",
  status,
  created_at AS "createdAt"`;

export const proposalModel = {
  async findTripForUpdate(
    client: PoolClient,
    tripId: string,
  ): Promise<ProposalTripRow | undefined> {
    const { rows } = await client.query<ProposalTripRow>(
      `SELECT id,
              type,
              start_date::text AS "startDate",
              end_date::text AS "endDate"
         FROM trips
        WHERE id = $1
        FOR UPDATE`,
      [tripId],
    );

    return rows[0];
  },

  async findMemberRole(
    client: PoolClient,
    tripId: string,
    userId: string,
  ): Promise<ProposalAccessRow> {
    const { rows } = await client.query<ProposalAccessRow>(
      `SELECT role
         FROM trip_members
        WHERE trip_id = $1
          AND user_id = $2`,
      [tripId, userId],
    );

    return rows[0] ?? { role: null };
  },

  async findTripRole(
    client: PoolClient,
    tripId: string,
    userId: string,
  ): Promise<TripRoleRow | undefined> {
    const { rows } = await client.query<TripRoleRow>(
      `SELECT m.role
         FROM trips t
         LEFT JOIN trip_members m
           ON m.trip_id = t.id
          AND m.user_id = $2
        WHERE t.id = $1`,
      [tripId, userId],
    );

    return rows[0];
  },

  async hasApprovedOverlap(
    client: PoolClient,
    tripId: string,
    day: string,
    startTime: string,
    endTime: string,
  ): Promise<boolean> {
    const { rows } = await client.query<OverlapRow>(
      `SELECT EXISTS (
         SELECT 1
           FROM proposals
          WHERE trip_id = $1
            AND day = $2
            AND status = 'approved'
            AND start_time < $4
            AND end_time > $3
       ) AS overlaps`,
      [tripId, day, startTime, endTime],
    );

    return rows[0].overlaps;
  },

  async create(client: PoolClient, proposal: NewProposal): Promise<Proposal> {
    const { rows } = await client.query<Proposal>(
      `INSERT INTO proposals (
         trip_id,
         author_id,
         place_name,
         lat,
         lon,
         category,
         day,
         start_time,
         end_time,
         note,
         voting_deadline,
         status
       )
       VALUES (
         $1,
         $2,
         $3,
         $4,
         $5,
         $6,
         $7,
         $8,
         $9,
         $10,
         now() + ($11 * interval '1 hour'),
         $12
       )
       RETURNING ${PROPOSAL_COLUMNS}`,
      [
        proposal.tripId,
        proposal.authorId,
        proposal.placeName,
        proposal.latitude,
        proposal.longitude,
        proposal.category,
        proposal.day,
        proposal.startTime,
        proposal.endTime,
        proposal.note,
        proposal.votingDurationHours,
        proposal.status,
      ],
    );

    return rows[0];
  },

  async listApproved(client: PoolClient, tripId: string): Promise<Proposal[]> {
    const { rows } = await client.query<Proposal>(
      `SELECT ${PROPOSAL_COLUMNS}
         FROM proposals
        WHERE trip_id = $1
          AND status = 'approved'
        ORDER BY day, start_time, id`,
      [tripId],
    );

    return rows;
  },
};

interface ProposalServiceDependencies {
  proposalModel: typeof proposalModel;
}

export function createProposalService({
  proposalModel,
}: ProposalServiceDependencies) {
  return {
    async listApproved(userId: string, tripId: string): Promise<Proposal[]> {
      const client = await pool.connect();

      try {
        const trip = await proposalModel.findTripRole(client, tripId, userId);
        if (!trip) {
          throw new AppError(404, 'NOT_FOUND', 'Trip not found');
        }
        if (!trip.role) {
          throw new AppError(
            403,
            'FORBIDDEN',
            'You must be a trip member to view its itinerary',
          );
        }

        return proposalModel.listApproved(client, tripId);
      } finally {
        client.release();
      }
    },

    async create(
      userId: string,
      tripId: string,
      input: CreateProposalInput,
    ): Promise<Proposal> {
      const client = await pool.connect();

      try {
        await client.query('BEGIN');

        const trip = await proposalModel.findTripForUpdate(client, tripId);
        if (!trip) {
          throw new AppError(404, 'NOT_FOUND', 'Trip not found');
        }

        const membership = await proposalModel.findMemberRole(
          client,
          tripId,
          userId,
        );
        if (!membership.role) {
          throw new AppError(
            403,
            'FORBIDDEN',
            'You must be a trip member to create a proposal',
          );
        }

        if (input.day < trip.startDate || input.day > trip.endDate) {
          throw new AppError(
            400,
            'VALIDATION_ERROR',
            'Proposal day must fall within the trip dates',
            [{ field: 'day', message: 'Choose a day within the trip dates' }],
          );
        }

        const overlaps = await proposalModel.hasApprovedOverlap(
          client,
          tripId,
          input.day,
          input.startTime,
          input.endTime,
        );
        if (overlaps) {
          throw new AppError(
            409,
            'ACTIVITY_TIME_CONFLICT',
            'The proposed time overlaps an approved activity',
          );
        }

        const status: Extract<ProposalStatus, 'open' | 'approved'> =
          trip.type === 'solo' ? 'approved' : 'open';
        const proposal = await proposalModel.create(client, {
          ...input,
          tripId,
          authorId: userId,
          note: input.note || null,
          status,
        });

        await client.query('COMMIT');
        return proposal;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
  };
}

export type ProposalService = ReturnType<typeof createProposalService>;
