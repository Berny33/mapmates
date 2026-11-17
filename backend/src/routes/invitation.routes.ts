import { Router } from 'express';
import { createInvitationController } from '../controllers/invitation.controller.js';
import { requireAuth } from '../middlewares/requireAuth.js';
import { validate } from '../middlewares/validate.js';
import {
  createInvitationService,
  invitationModel,
} from '../services/invitation.service.js';
import { invitationTokenParamsSchema } from '../validators/invitation.validators.js';

const router = Router();
const invitationController = createInvitationController(
  createInvitationService({ invitationModel }),
);

router
  .route('/:token')
  .all(requireAuth, validate(invitationTokenParamsSchema, 'params'))
  .get(invitationController.preview);

router.post(
  '/:token/join',
  requireAuth,
  validate(invitationTokenParamsSchema, 'params'),
  invitationController.join,
);

export default router;
