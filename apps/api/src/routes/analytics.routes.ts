import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import * as analyticsService from '../services/analytics.service';
import { success } from '../utils/response';
import { AppError } from '../utils/AppError';
import { prisma } from '../lib/prisma';

const router = Router();
router.use(authenticate);

router.get('/sales', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const storeId = req.query['storeId'] as string | undefined;
    const source = req.query['source'] as string | undefined;
    const product = req.query['product'] as string | undefined;
    const startDate = req.query['startDate'] as string | undefined;
    const endDate = req.query['endDate'] as string | undefined;

    if (storeId) {
      const store = await prisma.store.findFirst({
        where: { id: storeId, userId: req.user!.id },
      });
      if (!store) throw new AppError('NOT_FOUND', 'Store not found', 404);
    }

    const data = await analyticsService.getSalesAnalytics(req.user!.id, {
      storeId,
      source,
      product,
      startDate,
      endDate,
    });
    success(res, data);
  } catch (err) {
    next(err);
  }
});

export default router;
