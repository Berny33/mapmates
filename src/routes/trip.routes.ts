import { Router } from 'express';
import { createTripController } from '../controllers/trip.controller.js';
import { requireAuth } from '../middlewares/requireAuth.js';
import { validate } from '../middlewares/validate.js';
import { tripModel } from '../models/trip.model.js';
import { createTripService } from '../services/trip.service.js';
import { createTripSchema } from '../validators/trip.validators.js';

const router = Router();

const tripController = createTripController(createTripService({ tripModel }));

// Every trip route requires a session: forgetting it on a new route is hard.
router.use(requireAuth);

router.post('/', validate(createTripSchema), tripController.create);

export default router;
