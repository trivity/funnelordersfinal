import { Router, Request, Response, NextFunction } from 'express';
import express from 'express';
import { authenticate } from '../middleware/auth.middleware';
import * as billingService from '../services/billing.service';
import { stripe } from '../lib/stripe';
import { config } from '../lib/env';
import { success } from '../utils/response';
import { AppError } from '../utils/AppError';
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

// Stripe webhook — raw body, no auth
router.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const sig = req.headers['stripe-signature'];
      if (!sig) {
        res.status(400).json({ error: 'Missing stripe-signature' });
        return;
      }

      let event;
      try {
        event = stripe.webhooks.constructEvent(req.body as Buffer, sig, config.STRIPE_WEBHOOK_SECRET);
      } catch {
        res.status(400).json({ error: 'Invalid signature' });
        return;
      }

      await billingService.handleStripeEvent(event);
      res.json({ received: true });
    } catch (err) {
      next(err);
    }
  },
);

router.use(authenticate);

router.post('/create-checkout-session', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { planTier } = validate(z.object({ planTier: z.string() }), req.body);
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
