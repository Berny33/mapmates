import type { RequestHandler } from 'express';
import { AppError } from '../utils/AppError.js';

export const requireAuth: RequestHandler = (req, _res, next) => {
  if (!req.session.userId) {
    throw new AppError(401, 'UNAUTHENTICATED', 'Log in required');
  }
  next();
};
