import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';
import { AppError } from '../utils/AppError.js';

type RequestPart = 'body' | 'query' | 'params';

export function validate(
  schema: ZodType,
  part: RequestPart = 'body',
): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req[part]);

    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        field: issue.path.map(String).join('.'),
        message: issue.message,
      }));
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Invalid request data',
        details,
      );
    }

    if (part === 'body') {
      req.body = result.data;
    }
    next();
  };
}
