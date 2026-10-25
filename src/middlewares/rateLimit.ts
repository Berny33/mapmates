import { rateLimit } from 'express-rate-limit';
import { AppError } from '../utils/AppError.js';

interface LimiterOptions {
  windowMs: number;
  limit: number;
}

export function createRateLimiter({ windowMs, limit }: LimiterOptions) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (_req, _res, next) => {
      next(
        new AppError(
          429,
          'TOO_MANY_REQUESTS',
          'Too many requests, try again later',
        ),
      );
    },
  });
}
