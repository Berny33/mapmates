import type { Request, Response } from 'express';
import type { TripService } from '../services/trip.service.js';
import { getAuthenticatedUserId } from '../utils/session.js';

export function createTripController(tripService: TripService) {
  return {
    async create(req: Request, res: Response): Promise<void> {
      const trip = await tripService.createTrip(
        getAuthenticatedUserId(req),
        req.body,
      );

      res.status(201).json(trip);
    },
  };
}
