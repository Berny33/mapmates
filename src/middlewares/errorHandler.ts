import type { ErrorRequestHandler, RequestHandler, Response } from 'express';
import { AppError } from '../utils/AppError.js';

function sendError(
  res: Response,
  statusCode: number,
  code: string,
  message: string,
  details?: unknown,
): void {
  const payload: {
    error: {
      code: string;
      message: string;
      details?: unknown;
    };
  } = {
    error: { code, message },
  };

  if (details !== undefined) {
    payload.error.details = details;
  }

  res.status(statusCode).json(payload);
}

export const notFound: RequestHandler = (_req, _res, next) => {
  next(new AppError(404, 'NOT_FOUND', 'Resource not found'));
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    sendError(res, err.statusCode, err.code, err.message, err.details);
    return;
  }

  const status =
    typeof err === 'object' && err !== null && 'status' in err
      ? Number((err as { status?: number }).status)
      : 500;

  if (Number.isFinite(status) && status >= 400 && status < 500) {
    sendError(res, status, 'BAD_REQUEST', 'The request could not be processed');
    return;
  }

  console.error(err);
  sendError(res, 500, 'INTERNAL_ERROR', 'Internal server error');
};
