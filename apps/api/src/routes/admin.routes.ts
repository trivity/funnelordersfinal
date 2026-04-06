import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth.middleware';
import { prisma } from '../lib/prisma';
import { success, paginated } from '../utils/response';
import { parsePagination } from '../utils/pagination';
import { createAuditLog } from '../middleware/auditLog.middleware';
import { AppError } from '../utils/AppError';
import { sanitizeUser } from '../services/auth.service';
import * as appConfigService from '../services/appConfig.service';
import { stripe } from '../lib/stripe';

const router = Router();
router.use(authenticate, requireAdmin);

router.get('/stats', async (_req, res, next) => {
  try {
    const [totalUsers, activeSubscriptions, totalOrders, integrationBreakdown] = await Promise.all([
      prisma.user.count({ where: { status: 'ACTIVE' } }),
      prisma.user.count({ where: { subscriptionStatus: 'ACTIVE' } }),
      prisma.order.count({ where: { _adminScope: true } as never }),
      prisma.integration.groupBy({ by: ['platform'], _count: true }),
    ]);

    success(res, {
      totalUsers,
      activeSubscriptions,
      totalOrders,
      integrationBreakdown: integrationBreakdown.map((i) => ({
        platform: i.platform,
        count: i._count,
      })),
    });
  } catch (err) {
    next(err);
  }
});

router.get('/users', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit, skip } = parsePagination(req);
    const search = req.query['search'] as string | undefined;
    const status = req.query['status'] as string | undefined;
    const planTier = req.query['planTier'] as string | undefined;

    const where = {
      ...(status && { status: status as never }),
      ...(planTier && { planTier: planTier as never }),
      ...(search && {
        OR: [
          { email: { contains: search, mode: 'insensitive' as const } },
          { firstName: { contains: search, mode: 'insensitive' as const } },
          { lastName: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    };

    const [users, total] = await Promise.all([
      prisma.user.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      prisma.user.count({ where }),
    ]);

    paginated(res, users.map(sanitizeUser), { page, limit, total });
  } catch (err) {
    next(err);
  }
});

router.get('/users/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params['id'] as string },
      include: { _count: { select: { orders: true, integrations: true } } },
    });
    if (!user) throw new AppError('NOT_FOUND', 'User not found', 404);
    const { _count, ...userData } = user;
    success(res, { ...sanitizeUser(userData), _count });
  } catch (err) {
    next(err);
  }
});

router.patch('/users/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { role, status } = req.body as { role?: string; status?: string };
    const VALID_ROLES = ['ADMIN', 'USER'];
    const VALID_STATUSES = ['ACTIVE', 'SUSPENDED', 'DELETED'];
    if (role && !VALID_ROLES.includes(role)) {
      throw new AppError('VALIDATION_ERROR', `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}`, 400);
    }
    if (status && !VALID_STATUSES.includes(status)) {
      throw new AppError('VALIDATION_ERROR', `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`, 400);
    }
    const user = await prisma.user.update({
      where: { id: req.params['id'] as string },
      data: {
        ...(role && { role: role as never }),
        ...(status && { status: status as never }),
      },
    });
    await createAuditLog({
      userId: req.user!.id,
      action: 'ADMIN_USER_UPDATED',
      entityType: 'User',
      entityId: req.params['id'] as string,
    });
    success(res, sanitizeUser(user));
  } catch (err) {
    next(err);
  }
});

router.post('/users/:id/suspend', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.user.update({ where: { id: req.params['id'] as string }, data: { status: 'SUSPENDED' } });
    await createAuditLog({ userId: req.user!.id, action: 'USER_SUSPENDED', entityId: req.params['id'] as string });
    success(res, { message: 'User suspended' });
  } catch (err) {
    next(err);
  }
});

router.post('/users/:id/unsuspend', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.user.update({ where: { id: req.params['id'] as string }, data: { status: 'ACTIVE' } });
    await createAuditLog({ userId: req.user!.id, action: 'USER_UNSUSPENDED', entityId: req.params['id'] as string });
    success(res, { message: 'User reactivated' });
  } catch (err) {
    next(err);
  }
});

router.delete('/users/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.user.delete({ where: { id: req.params['id'] as string } });
    await createAuditLog({ userId: req.user!.id, action: 'ADMIN_USER_DELETED', entityId: req.params['id'] as string });
    success(res, { message: 'User deleted' });
  } catch (err) {
    next(err);
  }
});

router.get('/audit-logs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit, skip } = parsePagination(req);
    const userId = req.query['userId'] as string | undefined;
    const action = req.query['action'] as string | undefined;

    const where = {
      ...(userId && { userId }),
      ...(action && { action: { contains: action } }),
    };

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' }, include: { user: { select: { email: true } } } }),
      prisma.auditLog.count({ where }),
    ]);

    paginated(res, logs, { page, limit, total });
  } catch (err) {
    next(err);
  }
});

router.get('/orders', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit, skip } = parsePagination(req);
    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where: { _adminScope: true } as never,
        skip,
        take: limit,
        orderBy: { receivedAt: 'desc' },
        include: { user: { select: { email: true, firstName: true, lastName: true } } },
      }),
      prisma.order.count({ where: { _adminScope: true } as never }),
    ]);
    paginated(res, orders, { page, limit, total });
  } catch (err) {
    next(err);
  }
});

// ─── AppConfig Management ────────────────────────────────────────────────────

// GET /admin/config — get all app config (values masked for display)
router.get('/config', async (_req, res, next) => {
  try {
    const configs = await appConfigService.getAllConfigs();
    // Mask sensitive values
    const masked: Record<string, string> = {};
    for (const [key, value] of Object.entries(configs)) {
      masked[key] = value.length > 8 ? `${value.slice(0, 4)}${'*'.repeat(value.length - 8)}${value.slice(-4)}` : '****';
    }
    success(res, masked);
  } catch (err) {
    next(err);
  }
});

// PATCH /admin/config — update one or more config keys
router.patch('/config', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const updates = req.body as Record<string, string>;
    if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
      throw new AppError('VALIDATION_ERROR', 'Request body must be an object of key/value pairs', 400);
    }
    const ALLOWED_KEYS = new Set(Object.values(appConfigService.CONFIG_KEYS));
    for (const [key, value] of Object.entries(updates)) {
      if (!ALLOWED_KEYS.has(key as never)) {
        throw new AppError('VALIDATION_ERROR', `Unknown config key: ${key}`, 400);
      }
      if (typeof value !== 'string') continue;
      await appConfigService.setConfig(key, value);
    }
    await createAuditLog({
      userId: req.user!.id,
      action: 'APP_CONFIG_UPDATED',
      metadata: { keys: Object.keys(updates) } as Record<string, unknown>,
    });
    success(res, { message: 'Config updated', keys: Object.keys(updates) });
  } catch (err) {
    next(err);
  }
});

// POST /admin/stripe/sync-prices — create new Stripe prices for updated amounts
router.post('/stripe/sync-prices', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const plans = [
      { key: appConfigService.CONFIG_KEYS.STRIPE_PRICE_STARTER, amount: 2999, nickname: 'Starter' },
      { key: appConfigService.CONFIG_KEYS.STRIPE_PRICE_GROWTH, amount: 4999, nickname: 'Growth' },
      { key: appConfigService.CONFIG_KEYS.STRIPE_PRICE_AGENCY, amount: 9799, nickname: 'Agency' },
    ];

    const overrides = req.body as Record<string, number> | undefined;
    const results: Record<string, string> = {};

    for (const plan of plans) {
      const amountCents = overrides?.[plan.nickname.toLowerCase()] ?? plan.amount;

      // Get or create a product for this plan
      const productList = await stripe.products.list({ active: true, limit: 100 });
      let product = productList.data.find((p) => p.metadata?.planNickname === plan.nickname);
      if (!product) {
        product = await stripe.products.create({
          name: `FunnelOrders ${plan.nickname}`,
          metadata: { planNickname: plan.nickname },
        });
      }

      // Archive existing prices for this product
      const existingPriceId = await appConfigService.getConfig(plan.key);
      if (existingPriceId) {
        try {
          await stripe.prices.update(existingPriceId, { active: false });
        } catch {
          // Ignore if price not found
        }
      }

      // Create new price
      const newPrice = await stripe.prices.create({
        product: product.id,
        unit_amount: amountCents,
        currency: 'usd',
        recurring: { interval: 'month' },
        nickname: `${plan.nickname} Monthly`,
      });

      // Save new price ID to AppConfig
      await appConfigService.setConfig(plan.key, newPrice.id);
      results[plan.nickname] = newPrice.id;
    }

    await createAuditLog({
      userId: req.user!.id,
      action: 'STRIPE_PRICES_SYNCED',
      metadata: results as Record<string, unknown>,
    });

    success(res, { message: 'Stripe prices synced', prices: results });
  } catch (err) {
    next(err);
  }
});

export default router;
