import type { Request, Response } from 'express';
import type { InvitationService } from '../services/invitation.service.js';
import { AppError } from '../utils/AppError.js';
import { getAuthenticatedUserId } from '../utils/session.js';

function getTripId(req: Request): string {
  const tripId = req.params.tripId;

  if (typeof tripId !== 'string') {
    throw new AppError(400, 'VALIDATION_ERROR', 'Invalid trip id');
  }

  return tripId;
}

function getToken(req: Request): string {
  const token = req.params.token;

  if (typeof token !== 'string') {
    throw new AppError(400, 'VALIDATION_ERROR', 'Invalid invitation token');
  }

  return token;
}

export function createInvitationController(
  invitationService: InvitationService,
) {
  return {
    async preview(req: Request, res: Response): Promise<void> {
      const trip = await invitationService.preview(getToken(req));

      res.status(200).json(trip);
    },

    async getStatus(req: Request, res: Response): Promise<void> {
      const status = await invitationService.getStatus(
        getAuthenticatedUserId(req),
        getTripId(req),
      );

      res.status(200).json(status);
    },

    async generate(req: Request, res: Response): Promise<void> {
      const invitation = await invitationService.generate(
        getAuthenticatedUserId(req),
        getTripId(req),
      );

      res.status(201).json(invitation);
    },

    async revoke(req: Request, res: Response): Promise<void> {
      await invitationService.revoke(
        getAuthenticatedUserId(req),
        getTripId(req),
      );

      res.status(204).end();
    },

    async join(req: Request, res: Response): Promise<void> {
      const result = await invitationService.join(
        getAuthenticatedUserId(req),
        getToken(req),
      );

      res.status(200).json(result);
    },
  };
}
