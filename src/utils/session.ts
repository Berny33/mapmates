import type { Request } from 'express';
import { AppError } from './AppError.js';

export function getAuthenticatedUserId(req: Request): string {
  const userId = req.session.userId;

  if (!userId) {
    throw new AppError(401, 'UNAUTHENTICATED', 'Log in required');
  }

  return userId;
}
