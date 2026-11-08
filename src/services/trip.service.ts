import { pool } from '../config/db.js';
import type { NewTrip, Trip, TripWithRole } from '../models/trip.model.js';
import { AppError } from '../utils/AppError.js';
import { isForeignKeyViolation } from '../utils/dbErrors.js';
import type { CreateTripInput } from '../validators/trip.validators.js';

const DEFAULT_MAX_MEMBERS = 15;

// Dates are read as text (YYYY-MM-DD) so the driver does not turn them into
// JavaScript dates, which would shift them with the server's time zone.
const TRIP_COLUMNS = `id, name, destination,
  start_date::text AS "startDate", end_date::text AS "endDate",
  type, max_members AS "maxMembers", created_at AS "createdAt"`;

export const tripModel = {
  async createWithOrganizer(userId: string, trip: NewTrip): Promise<Trip> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const { rows } = await client.query<Trip>(
        `INSERT INTO trips (name, destination, start_date, end_date, type, max_members)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING ${TRIP_COLUMNS}`,
        [
          trip.name,
          trip.destination,
          trip.startDate,
          trip.endDate,
          trip.type,
          trip.maxMembers,
        ],
      );

      await client.query(
        `INSERT INTO trip_members (trip_id, user_id, role)
         VALUES ($1, $2, 'organizer')`,
        [rows[0].id, userId],
      );

      await client.query('COMMIT');

      return rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  async listForUser(userId: string): Promise<TripWithRole[]> {
    const { rows } = await pool.query<TripWithRole>(
      `SELECT ${TRIP_COLUMNS}, m.role
         FROM trips t
         JOIN trip_members m ON m.trip_id = t.id
        WHERE m.user_id = $1
        ORDER BY t.start_date, t.created_at, t.id`,
      [userId],
    );

    return rows;
  },
};

interface TripServiceDependencies {
  tripModel: Pick<typeof tripModel, 'createWithOrganizer' | 'listForUser'>;
}

export function createTripService({ tripModel }: TripServiceDependencies) {
  return {
    async createTrip(
      userId: string,
      input: CreateTripInput,
    ): Promise<TripWithRole> {
      const maxMembers = input.type === 'solo' ? 1 : DEFAULT_MAX_MEMBERS;

      try {
        const trip = await tripModel.createWithOrganizer(userId, {
          ...input,
          maxMembers,
        });

        return { ...trip, role: 'organizer' };
      } catch (error) {
        if (isForeignKeyViolation(error)) {
          throw new AppError(401, 'UNAUTHENTICATED', 'Log in required');
        }
        throw error;
      }
    },

    listTrips(userId: string): Promise<TripWithRole[]> {
      return tripModel.listForUser(userId);
    },
  };
}

export type TripService = ReturnType<typeof createTripService>;
