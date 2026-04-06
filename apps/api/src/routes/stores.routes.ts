import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import * as storesService from '../services/stores.service';
import { success, created } from '../utils/response';

const router = Router();
router.use(authenticate);

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stores = await storesService.getUserStores(req.user!.id);
    success(res, stores);
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name } = req.body as { name?: string };
    if (!name?.trim()) throw new Error('Store name is required');
    const store = await storesService.createStore(req.user!.id, name.trim());
    created(res, store);
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name } = req.body as { name?: string };
    if (!name?.trim()) throw new Error('Store name is required');
    const store = await storesService.updateStore(req.user!.id, req.params['id'] as string, name.trim());
    success(res, store);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await storesService.deleteStore(req.user!.id, req.params['id'] as string);
    success(res, { message: 'Store deleted' });
  } catch (err) {
    next(err);
  }
});

export default router;
