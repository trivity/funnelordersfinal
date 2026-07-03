import { Request, Response, NextFunction } from 'express';
import Stripe from 'stripe';
import { AppError } from '../utils/AppError';
import { logger } from '../lib/logger';

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        ...(process.env.NODE_ENV !== 'production' && err.details !== undefined && { details: err.details }),
      },
    });
    return;
  }

  if (err instanceof Stripe.errors.StripeError) {
    logger.error('Stripe error', { type: err.type, message: err.message });
    res.status(502).json({
      success: false,
      error: { code: 'STRIPE_ERROR', message: err.message },
    });
    return;
  }

  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  res.status(500).json({
    success: false,
    error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' },
  });
}
