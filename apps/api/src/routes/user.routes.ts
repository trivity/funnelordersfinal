import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { authenticate } from '../middleware/auth.middleware';
import { prisma } from '../lib/prisma';
import { validate, updateProfileSchema, changePasswordSchema, updateNotificationsSchema } from '../utils/validation';
import { success } from '../utils/response';
import { AppError } from '../utils/AppError';
import { sanitizeUser } from '../services/auth.service';
import { createAuditLog } from '../middleware/auditLog.middleware';

const router = Router();
router.use(authenticate);

router.get('/profile', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) throw new AppError('NOT_FOUND', 'User not found', 404);
    success(res, sanitizeUser(user));
  } catch (err) {
    next(err);
  }
});

router.patch('/profile', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = validate(updateProfileSchema, req.body);

    if (body.email) {
      const existing = await prisma.user.findFirst({
        where: { email: body.email, NOT: { id: req.user!.id } },
      });
      if (existing) throw new AppError('EMAIL_TAKEN', 'Email is already taken', 409);
    }

    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: body,
    });
    success(res, sanitizeUser(user));
  } catch (err) {
    next(err);
  }
});

router.patch('/password', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { currentPassword, newPassword } = validate(changePasswordSchema, req.body);
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) throw new AppError('NOT_FOUND', 'User not found', 404);

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) throw new AppError('INVALID_CREDENTIALS', 'Current password is incorrect', 401);

    const hash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: hash } });
    await createAuditLog({ userId: user.id, action: 'PASSWORD_CHANGED' });
    success(res, { message: 'Password updated' });
  } catch (err) {
    next(err);
  }
});

router.delete('/account', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.user.update({
      where: { id: req.user!.id },
      data: { status: 'DELETED' },
    });
    await createAuditLog({ userId: req.user!.id, action: 'ACCOUNT_DELETION_REQUESTED' });
    success(res, { message: 'Account deletion requested. Your data will be removed within 30 days.' });
  } catch (err) {
    next(err);
  }
});

router.patch('/notifications', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = validate(updateNotificationsSchema, req.body);
    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: body,
    });
    success(res, sanitizeUser(user));
  } catch (err) {
    next(err);
  }
});

router.patch('/onboarding', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { completed } = req.body as { completed?: boolean };
    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: { onboardingCompleted: completed === true },
    });
    success(res, sanitizeUser(user));
  } catch (err) {
    next(err);
  }
});

export default router;
