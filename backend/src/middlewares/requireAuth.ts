import type { RequestHandler } from 'express';
import { getAuthenticatedUserId } from '../utils/session.js';

export const requireAuth: RequestHandler = (req, _res, next) => {
  getAuthenticatedUserId(req);
  next();
};
