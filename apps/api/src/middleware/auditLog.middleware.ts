import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';

export async function createAuditLog(opts: {
  userId?: string;
  action: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}): Promise<void> {
  try {
    await prisma.auditLog.create({ data: opts as Parameters<typeof prisma.auditLog.create>[0]['data'] });
  } catch (err) {
    logger.error('Failed to write audit log', { error: err });
  }
}
