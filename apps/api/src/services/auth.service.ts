import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid'; // uuid v13 re-exports v4
import { prisma } from '../lib/prisma';
import { config } from '../lib/env';
import { AppError } from '../utils/AppError';
import { createAuditLog } from '../middleware/auditLog.middleware';
import { logger } from '../lib/logger';

const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL_DAYS = 30;

function signAccessToken(userId: string, email: string, role: string): string {
  return jwt.sign({ id: userId, email, role }, config.JWT_ACCESS_SECRET, {
    expiresIn: ACCESS_TOKEN_TTL,
  });
}

export async function register(
  email: string,
  password: string,
  firstName: string,
  lastName: string,
) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new AppError('EMAIL_TAKEN', 'Email is already registered', 409);

  const passwordHash = await bcrypt.hash(password, 12);
  const trialEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  // Create user + default store atomically
  let user: Awaited<ReturnType<typeof prisma.user.create>>;
  try {
    user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email,
          passwordHash,
          firstName,
          lastName,
          subscriptionStatus: 'TRIALING' as never,
          trialEndsAt,
        },
      });
      await tx.store.create({ data: { userId: newUser.id, name: 'My Store' } });
      return newUser;
    });
  } catch (err) {
    logger.error('Failed to create user during registration', { error: (err as Error).message });
    throw new AppError('INTERNAL_ERROR', 'Registration failed. Please try again.', 500);
  }

  const accessToken = signAccessToken(user.id, user.email, user.role);
  const refreshToken = await createRefreshToken(user.id, undefined, undefined);

  await createAuditLog({ userId: user.id, action: 'USER_REGISTERED', entityType: 'User', entityId: user.id });

  return { user: sanitizeUser(user), accessToken, refreshToken };
}

export async function login(
  email: string,
  password: string,
  ipAddress?: string,
  userAgent?: string,
) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new AppError('INVALID_CREDENTIALS', 'Invalid email or password', 401);
  if (user.status === 'DELETED') throw new AppError('ACCOUNT_DELETED', 'Account not found', 401);
  if (user.status === 'SUSPENDED')
    throw new AppError('ACCOUNT_SUSPENDED', 'Account has been suspended', 403);

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw new AppError('INVALID_CREDENTIALS', 'Invalid email or password', 401);

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  const accessToken = signAccessToken(user.id, user.email, user.role);
  const refreshToken = await createRefreshToken(user.id, ipAddress, userAgent);

  await createAuditLog({
    userId: user.id,
    action: 'USER_LOGIN',
    entityType: 'User',
    entityId: user.id,
    ipAddress,
    userAgent,
  });

  return { user: sanitizeUser(user), accessToken, refreshToken };
}

export async function refreshAccessToken(tokenValue: string) {
  const storedToken = await prisma.refreshToken.findUnique({ where: { token: tokenValue } });
  if (!storedToken || storedToken.revokedAt || storedToken.expiresAt < new Date()) {
    throw new AppError('INVALID_REFRESH_TOKEN', 'Invalid or expired refresh token', 401);
  }

  const user = await prisma.user.findUnique({ where: { id: storedToken.userId } });
  if (!user || user.status !== 'ACTIVE') {
    throw new AppError('UNAUTHORIZED', 'User not found or inactive', 401);
  }

  // Rotate: revoke old, issue new
  await prisma.refreshToken.update({
    where: { id: storedToken.id },
    data: { revokedAt: new Date() },
  });
  const newRefreshToken = await createRefreshToken(user.id, storedToken.ipAddress ?? undefined, storedToken.userAgent ?? undefined);
  const accessToken = signAccessToken(user.id, user.email, user.role);

  return { accessToken, refreshToken: newRefreshToken };
}

export async function logout(tokenValue: string) {
  await prisma.refreshToken.updateMany({
    where: { token: tokenValue, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

async function createRefreshToken(userId: string, ipAddress?: string, userAgent?: string): Promise<string> {
  const token = uuidv4();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_TTL_DAYS);
  await prisma.refreshToken.create({ data: { token, userId, expiresAt, ipAddress, userAgent } });
  return token;
}

export function sanitizeUser(user: {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  status: string;
  planTier: string;
  subscriptionStatus: string;
  createdAt: Date;
  lastLoginAt: Date | null;
  onboardingCompleted?: boolean;
  notifyOnFailure?: boolean;
  alertEmail?: string | null;
  slackWebhookUrl?: string | null;
  trialEndsAt?: Date | null;
}) {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    status: user.status,
    planTier: user.planTier,
    subscriptionStatus: user.subscriptionStatus,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
    onboardingCompleted: user.onboardingCompleted ?? false,
    notifyOnFailure: user.notifyOnFailure ?? true,
    alertEmail: user.alertEmail ?? null,
    slackWebhookUrl: user.slackWebhookUrl ?? null,
    trialEndsAt: user.trialEndsAt ?? null,
  };
}
