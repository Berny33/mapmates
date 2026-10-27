import type { TripModel, TripWithRole } from '../models/trip.model.js';
import { AppError } from '../utils/AppError.js';
import { isForeignKeyViolation } from '../utils/dbErrors.js';
import type { CreateTripInput } from '../validators/trip.validators.js';

const DEFAULT_MAX_MEMBERS = 15;

interface TripServiceDependencies {
  tripModel: Pick<TripModel, 'createWithOrganizer' | 'listForUser'>;
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
          // The session points to a user that no longer exists.
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
