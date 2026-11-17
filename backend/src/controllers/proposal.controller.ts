import type { Request, Response } from 'express';
import type { ProposalService } from '../services/proposal.service.js';
import { AppError } from '../utils/AppError.js';
import { getAuthenticatedUserId } from '../utils/session.js';

function getTripId(req: Request): string {
  const tripId = req.params.tripId;
  if (typeof tripId !== 'string') {
    throw new AppError(400, 'VALIDATION_ERROR', 'Invalid trip id');
  }

  return tripId;
}

export function createProposalController(proposalService: ProposalService) {
  return {
    async listApproved(req: Request, res: Response): Promise<void> {
      const proposals = await proposalService.listApproved(
        getAuthenticatedUserId(req),
        getTripId(req),
      );

      res.status(200).json(proposals);
    },

    async create(req: Request, res: Response): Promise<void> {
      const proposal = await proposalService.create(
        getAuthenticatedUserId(req),
        getTripId(req),
        req.body,
      );

      res.status(201).json(proposal);
    },
  };
}
