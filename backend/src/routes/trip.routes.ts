import { Router } from 'express';
import { createInvitationController } from '../controllers/invitation.controller.js';
import { createTripController } from '../controllers/trip.controller.js';
import { requireAuth } from '../middlewares/requireAuth.js';
import { validate } from '../middlewares/validate.js';
import {
  createInvitationService,
  invitationModel,
} from '../services/invitation.service.js';
import { createTripService, tripModel } from '../services/trip.service.js';
import { invitationParamsSchema } from '../validators/invitation.validators.js';
import { createTripSchema } from '../validators/trip.validators.js';

const router = Router();

const tripController = createTripController(createTripService({ tripModel }));
const invitationController = createInvitationController(
  createInvitationService({ invitationModel }),
);

// Every trip route requires a session: forgetting it on a new route is hard.
router.use(requireAuth);

router.post('/', validate(createTripSchema), tripController.create);

router.get('/', tripController.list);

router
  .route('/:tripId/invitation')
  .all(validate(invitationParamsSchema, 'params'))
  .get(invitationController.getStatus)
  .post(invitationController.generate)
  .delete(invitationController.revoke);

export default router;
