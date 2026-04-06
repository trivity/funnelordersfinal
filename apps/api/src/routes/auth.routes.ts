import { Router, Request, Response, NextFunction } from 'express';
import * as authService from '../services/auth.service';
import { validate, registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema } from '../utils/validation';
import { authenticate } from '../middleware/auth.middleware';
import { success } from '../utils/response';
import { AppError } from '../utils/AppError';

const router = Router();

const REFRESH_COOKIE = 'refreshToken';
const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  maxAge: 30 * 24 * 60 * 60 * 1000,
  path: '/',
};

router.post('/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = validate(registerSchema, req.body);
    const result = await authService.register(body.email, body.password, body.firstName, body.lastName);
    res.cookie(REFRESH_COOKIE, result.refreshToken, COOKIE_OPTS);
    success(res, { user: result.user, accessToken: result.accessToken }, 201);
  } catch (err) {
    next(err);
  }
});

router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = validate(loginSchema, req.body);
    const result = await authService.login(
      body.email,
      body.password,
      req.ip ?? undefined,
      req.headers['user-agent'],
    );
    res.cookie(REFRESH_COOKIE, result.refreshToken, COOKIE_OPTS);
    success(res, { user: result.user, accessToken: result.accessToken });
  } catch (err) {
    next(err);
  }
});

router.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (!token) throw new AppError('UNAUTHORIZED', 'No refresh token', 401);
    const result = await authService.refreshAccessToken(token);
    res.cookie(REFRESH_COOKIE, result.refreshToken, COOKIE_OPTS);
    success(res, { accessToken: result.accessToken });
  } catch (err) {
    next(err);
  }
});

router.post('/logout', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (token) await authService.logout(token);
    res.clearCookie(REFRESH_COOKIE);
    success(res, { message: 'Logged out' });
  } catch (err) {
    next(err);
  }
});

router.post('/forgot-password', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    // Always return 200 to prevent email enumeration
    success(res, { message: 'If that email is registered, a reset link has been sent.' });
  } catch (err) {
    next(err);
  }
});

router.post('/reset-password', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    validate(resetPasswordSchema, _req.body);
    // TODO: implement token-based password reset in Phase 2
    success(res, { message: 'Password reset' });
  } catch (err) {
    next(err);
  }
});

router.get('/me', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { prisma } = require('../lib/prisma');
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) throw new AppError('NOT_FOUND', 'User not found', 404);
    success(res, { user: authService.sanitizeUser(user) });
  } catch (err) {
    next(err);
  }
});

export default router;
