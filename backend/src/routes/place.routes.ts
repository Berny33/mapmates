import { Router } from 'express';
import { nominatimAdapter } from '../adapters/nominatim.adapter.js';
import { createPlaceController } from '../controllers/place.controller.js';
import { requireAuth } from '../middlewares/requireAuth.js';
import { validate } from '../middlewares/validate.js';
import { createPlaceService } from '../services/place.service.js';
import { placeSearchQuerySchema } from '../validators/place.validators.js';

const router = Router();
const placeController = createPlaceController(
  createPlaceService({ geocodingAdapter: nominatimAdapter }),
);

router.get(
  '/search',
  requireAuth,
  validate(placeSearchQuerySchema, 'query'),
  placeController.search,
);

export default router;
