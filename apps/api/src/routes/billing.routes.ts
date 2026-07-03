import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import * as billingService from '../services/billing.service';
import { getStripe, getStripeWebhookSecret } from '../lib/stripe';
import { success } from '../utils/response';
import { z } from 'zod';
import { validate } from '../utils/validation';

const router = Router();

router.get('/plans', (_req, res, next) => {
  try {
    success(res, billingService.PLANS);
  } catch (err) {
    next(err);
  }
});

// Stripe webhook — uses rawBody captured in app.ts middleware
router.post('/webhook', async (req: Request & { rawBody?: Buffer }, res: Response, next: NextFunction) => {
  try {
    const sig = req.headers['stripe-signature'];
    if (!sig) {
      res.status(400).json({ error: 'Missing stripe-signature' });
      return;
    }

    const rawBody = req.rawBody;
    if (!rawBody?.length) {
      res.status(400).json({ error: 'Missing request body' });
      return;
    }

    const webhookSecret = await getStripeWebhookSecret();
    const stripe = await getStripe();

    let event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
    } catch {
      res.status(400).json({ error: 'Invalid signature' });
      return;
    }

    await billingService.handleStripeEvent(event);
    res.json({ received: true });
  } catch (err) {
    next(err);
  }
});

router.use(authenticate);

router.post('/create-checkout-session', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { planTier } = validate(
      z.object({ planTier: z.enum(['STARTER', 'GROWTH', 'AGENCY']) }),
      req.body,
    );
    const url = await billingService.createCheckoutSession(req.user!.id, planTier);
    success(res, { url });
  } catch (err) {
    next(err);
  }
});

router.post('/create-portal-session', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const url = await billingService.createPortalSession(req.user!.id);
    success(res, { url });
  } catch (err) {
    next(err);
  }
});

router.get('/subscription', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sub = await billingService.getSubscription(req.user!.id);
    success(res, sub);
  } catch (err) {
    next(err);
  }
});

export default router;
