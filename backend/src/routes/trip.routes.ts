import { Router } from 'express';
import { createInvitationController } from '../controllers/invitation.controller.js';
import { createProposalController } from '../controllers/proposal.controller.js';
import { createTripController } from '../controllers/trip.controller.js';
import { requireAuth } from '../middlewares/requireAuth.js';
import { validate } from '../middlewares/validate.js';
import {
  createInvitationService,
  invitationModel,
} from '../services/invitation.service.js';
import {
  createProposalService,
  proposalModel,
} from '../services/proposal.service.js';
import { createTripService, tripModel } from '../services/trip.service.js';
import { invitationParamsSchema } from '../validators/invitation.validators.js';
import {
  createProposalSchema,
  proposalParamsSchema,
  proposalVoteParamsSchema,
  proposalVoteSchema,
} from '../validators/proposal.validators.js';
import { createTripSchema } from '../validators/trip.validators.js';

const router = Router();

const tripController = createTripController(createTripService({ tripModel }));
const invitationController = createInvitationController(
  createInvitationService({ invitationModel }),
);
const proposalController = createProposalController(
  createProposalService({ proposalModel }),
);

// Every trip route requires a session: forgetting it on a new route is hard.
router.use(requireAuth);

router.post('/', validate(createTripSchema), tripController.create);

router.get('/', tripController.list);

router.get(
  '/:tripId/itinerary',
  validate(proposalParamsSchema, 'params'),
  proposalController.listApproved,
);

router.get(
  '/:tripId/proposals',
  validate(proposalParamsSchema, 'params'),
  proposalController.listAll,
);

router.post(
  '/:tripId/proposals',
  validate(proposalParamsSchema, 'params'),
  validate(createProposalSchema),
  proposalController.create,
);

router.post(
  '/:tripId/proposals/:proposalId/vote',
  validate(proposalVoteParamsSchema, 'params'),
  validate(proposalVoteSchema),
  proposalController.vote,
);

router
  .route('/:tripId/invitation')
  .all(validate(invitationParamsSchema, 'params'))
  .get(invitationController.getStatus)
  .post(invitationController.generate)
  .delete(invitationController.revoke);

export default router;
