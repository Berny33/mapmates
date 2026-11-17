import type { Request, Response } from 'express';
import type { PlaceService } from '../services/place.service.js';
import { AppError } from '../utils/AppError.js';

export function createPlaceController(placeService: PlaceService) {
  return {
    async search(req: Request, res: Response): Promise<void> {
      const { q } = req.query;
      if (typeof q !== 'string') {
        throw new AppError(400, 'VALIDATION_ERROR', 'Invalid search term');
      }

      const places = await placeService.search(q.trim());

      res.status(200).json(places);
    },
  };
}
