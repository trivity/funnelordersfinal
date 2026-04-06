import { Router, Request, Response, NextFunction } from 'express';
import * as authService from '../services/auth.service';
import { validate, registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema } from '../utils/validation';
import { authenticate } from '../middleware/auth.middleware';
import { authLimiter } from '../middleware/rateLimit.middleware';
import { success } from '../utils/response';
import { AppError } from '../utils/AppError';
import { prisma } from '../lib/prisma';
import { nanoid } from 'nanoid';
import bcrypt from 'bcryptjs';
import { config } from '../lib/env';
import { sendPasswordResetEmail } from '../lib/email';

const router = Router();

const REFRESH_COOKIE = 'refreshToken';
const isProduction = process.env.NODE_ENV === 'production';
const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: (isProduction ? 'none' : 'lax') as 'none' | 'lax',
  secure: isProduction,
  maxAge: 30 * 24 * 60 * 60 * 1000,
  path: '/',
};

router.post('/register', authLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = validate(registerSchema, req.body);
    const result = await authService.register(body.email, body.password, body.firstName, body.lastName);
    res.cookie(REFRESH_COOKIE, result.refreshToken, COOKIE_OPTS);
    success(res, { user: result.user, accessToken: result.accessToken }, 201);
  } catch (err) {
    next(err);
  }
});

router.post('/login', authLimiter, async (req: Request, res: Response, next: NextFunction) => {
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

router.post('/forgot-password', authLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = validate(forgotPasswordSchema, req.body);
    const user = await prisma.user.findUnique({ where: { email: body.email } });
    if (user) {
      const token = nanoid(48);
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
      await prisma.passwordResetToken.create({ data: { userId: user.id, token, expiresAt } });
      const resetUrl = `${config.APP_URL}/reset-password?token=${token}`;
      await sendPasswordResetEmail(user.email, resetUrl);
    }
    // Always return 200 to prevent email enumeration
    success(res, { message: 'If that email is registered, a reset link has been sent.' });
  } catch (err) {
    next(err);
  }
});

router.post('/reset-password', authLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = validate(resetPasswordSchema, req.body);
    const record = await prisma.passwordResetToken.findUnique({ where: { token: body.token } });
    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new AppError('INVALID_TOKEN', 'Reset link is invalid or has expired', 400);
    }
    const passwordHash = await bcrypt.hash(body.password, 12);
    await prisma.user.update({ where: { id: record.userId }, data: { passwordHash } });
    await prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } });
    success(res, { message: 'Password has been reset. You can now log in.' });
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
