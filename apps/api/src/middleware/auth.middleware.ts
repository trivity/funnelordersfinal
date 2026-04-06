import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../lib/env';
import { AppError } from '../utils/AppError';
import { prisma } from '../lib/prisma';

export interface AuthUser {
  id: string;
  email: string;
  role: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      storeId?: string;
    }
  }
}

export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return next(new AppError('UNAUTHORIZED', 'Missing or invalid authorization header', 401));
  }

  const token = header.slice(7);
  let payload: AuthUser;
  try {
    payload = jwt.verify(token, config.JWT_ACCESS_SECRET) as AuthUser;
    req.user = payload;
  } catch {
    return next(new AppError('UNAUTHORIZED', 'Invalid or expired token', 401));
  }

  // Resolve storeId from X-Store-Id header
  const storeIdHeader = req.headers['x-store-id'] as string | undefined;
  if (storeIdHeader) {
    try {
      const store = await prisma.store.findFirst({ where: { id: storeIdHeader, userId: payload.id } });
      if (!store) {
        res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Invalid store' } });
        return;
      }
      req.storeId = storeIdHeader;
    } catch {
      return next(new AppError('INTERNAL_ERROR', 'Failed to resolve store', 500));
    }
  }

  next();
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) return next(new AppError('UNAUTHORIZED', 'Not authenticated', 401));
  if (req.user.role !== 'ADMIN')
    return next(new AppError('FORBIDDEN', 'Admin access required', 403));
  next();
}

export async function optionalAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return next();
  try {
    const payload = jwt.verify(header.slice(7), config.JWT_ACCESS_SECRET) as AuthUser;
    req.user = payload;
    // Resolve storeId from X-Store-Id header for optional auth too
    const storeIdHeader = req.headers['x-store-id'] as string | undefined;
    if (storeIdHeader) {
      const store = await prisma.store.findFirst({ where: { id: storeIdHeader, userId: payload.id } });
      if (store) req.storeId = storeIdHeader;
    }
  } catch {
    // Optional — continue without user
  }
  next();
}
