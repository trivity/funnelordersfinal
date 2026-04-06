import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import * as ordersService from '../services/orders.service';
import { validate, createOrderSchema, patchOrderSchema, pushOrderSchema } from '../utils/validation';
import { success, paginated, created } from '../utils/response';
import { parsePagination } from '../utils/pagination';
import { enqueueOutboundPush } from '../jobs/queues';
import { AppError } from '../utils/AppError';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';

const router = Router();
router.use(authenticate);

router.get('/stats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = await ordersService.getOrderStats(req.user!.id, req.storeId);
    success(res, stats);
  } catch (err) {
    next(err);
  }
});

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit, skip } = parsePagination(req);
    const { orders, total } = await ordersService.listOrders(req.user!.id, {
      page, limit, skip,
      storeId: req.storeId,
      status: req.query['status'] as string,
      source: req.query['source'] as string,
      startDate: req.query['startDate'] as string,
      endDate: req.query['endDate'] as string,
      search: req.query['search'] as string,
    });
    paginated(res, orders, { page, limit, total });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const order = await ordersService.getOrder(req.user!.id, req.params['id'] as string, req.storeId);
    success(res, order);
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = validate(createOrderSchema, req.body);
    const order = await ordersService.createManualOrder(req.user!.id, {
      source: 'MANUAL',
      ...body,
      lineItems: body.lineItems.map((li) => ({ ...li, id: undefined })),
      subtotal: body.subtotal,
      total: body.total,
    } as never, req.storeId);
    created(res, order);
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = validate(patchOrderSchema, req.body);
    const order = await ordersService.patchOrder(req.user!.id, req.params['id'] as string, body, req.storeId);
    success(res, order);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const order = await ordersService.archiveOrder(req.user!.id, req.params['id'] as string, req.storeId);
    success(res, order);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/push', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { destination } = validate(pushOrderSchema, req.body);
    const order = await ordersService.getOrder(req.user!.id, req.params['id'] as string, req.storeId);

    // Create routing log and enqueue
    const routingLog = await prisma.orderRoutingLog.create({
      data: { orderId: order.id, destination: destination as never, status: 'PENDING' },
    });
    await enqueueOutboundPush(order.id, destination, routingLog.id, req.user!.id, req.storeId);
    success(res, { message: 'Push queued', routingLogId: routingLog.id });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/retry', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { routingLogId } = req.body as { routingLogId?: string };
    logger.info('Retry request', { orderId: req.params['id'], routingLogId, body: req.body });
    if (!routingLogId) throw new AppError('VALIDATION_ERROR', 'routingLogId required', 400);

    const order = await ordersService.getOrder(req.user!.id, req.params['id'] as string, req.storeId);
    const log = await prisma.orderRoutingLog.findFirst({
      where: { id: routingLogId, orderId: order.id },
    });
    if (!log) throw new AppError('NOT_FOUND', 'Routing log not found', 404);

    await prisma.orderRoutingLog.update({ where: { id: log.id }, data: { status: 'PENDING' } });
    await enqueueOutboundPush(order.id, log.destination, log.id, req.user!.id, req.storeId);
    success(res, { message: 'Retry queued' });
  } catch (err) {
    next(err);
  }
});

router.get('/:id/routing-logs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const order = await ordersService.getOrder(req.user!.id, req.params['id'] as string, req.storeId);
    const logs = await prisma.orderRoutingLog.findMany({
      where: { orderId: order.id },
      orderBy: { createdAt: 'desc' },
    });
    success(res, logs);
  } catch (err) {
    next(err);
  }
});

export default router;
