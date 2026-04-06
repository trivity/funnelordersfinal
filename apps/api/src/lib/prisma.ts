import { PrismaClient } from '@prisma/client';
import { logger } from './logger';

const prisma = new PrismaClient({
  log: [
    { emit: 'event', level: 'query' },
    { emit: 'event', level: 'error' },
    { emit: 'event', level: 'warn' },
  ],
});

// Multi-tenant safety middleware
// Bypass by passing { where: { _adminScope: true } } or any query with no where (admin global queries)
prisma.$use(async (params, next) => {
  const USER_SCOPED_MODELS = ['Order', 'Integration', 'RoutingRule', 'WebhookEndpoint'];
  const WRITE_ACTIONS = ['create', 'createMany', 'upsert', 'update', 'updateMany', 'delete', 'deleteMany'];
  const ADMIN_GLOBAL_ACTIONS = ['groupBy', 'aggregate']; // always allowed without userId
  if (
    USER_SCOPED_MODELS.includes(params.model ?? '') &&
    !WRITE_ACTIONS.includes(params.action) &&
    !ADMIN_GLOBAL_ACTIONS.includes(params.action)
  ) {
    const where = params.args?.where;
    // Allow if userId OR storeId is present, or if _adminScope flag is set, or if where is completely absent (global admin count)
    const hasUserId = where?.userId !== undefined;
    const hasStoreId = where?.storeId !== undefined;
    const isAdminScope = where?._adminScope === true;
    const isGlobalQuery = where === undefined || where === null;
    if (!hasUserId && !hasStoreId && !isAdminScope && !isGlobalQuery) {
      logger.warn('Query missing userId/storeId scope', { model: params.model, action: params.action });
      if (process.env.NODE_ENV === 'development') {
        throw new Error(`Query on ${params.model} missing userId/storeId scope`);
      }
    }
    // Strip the internal flag before sending to DB
    if (isAdminScope && where) {
      delete where._adminScope;
    }
  }
  return next(params);
});

export { prisma };
