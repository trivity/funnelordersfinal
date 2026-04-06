import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import * as routingService from '../services/routing.service';
import { validate, createRoutingRuleSchema, reorderRulesSchema } from '../utils/validation';
import { success, created } from '../utils/response';

const router = Router();
router.use(authenticate);

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rules = await routingService.listRoutingRules(req.user!.id, req.storeId);
    success(res, rules);
  } catch (err) {
    next(err);
  }
});

router.post('/reorder', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orderedIds } = validate(reorderRulesSchema, req.body);
    await routingService.reorderRules(req.user!.id, orderedIds, req.storeId);
    success(res, { message: 'Rules reordered' });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rule = await routingService.getRoutingRule(req.user!.id, req.params['id'] as string, req.storeId);
    success(res, rule);
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = validate(createRoutingRuleSchema, req.body);
    const rule = await routingService.createRoutingRule(req.user!.id, body as never, req.storeId);
    created(res, rule);
  } catch (err) {
    next(err);
  }
});

router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = validate(createRoutingRuleSchema, req.body);
    const rule = await routingService.updateRoutingRule(req.user!.id, req.params['id'] as string, body as never, req.storeId);
    success(res, rule);
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rule = await routingService.updateRoutingRule(req.user!.id, req.params['id'] as string, req.body as never, req.storeId);
    success(res, rule);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await routingService.deleteRoutingRule(req.user!.id, req.params['id'] as string, req.storeId);
    success(res, { message: 'Rule deleted' });
  } catch (err) {
    next(err);
  }
});

export default router;
