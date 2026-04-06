import { stripe } from '../lib/stripe';
import { prisma } from '../lib/prisma';
import { config } from '../lib/env';
import { AppError } from '../utils/AppError';
import { createAuditLog } from '../middleware/auditLog.middleware';
import { logger } from '../lib/logger';
import Stripe from 'stripe';
import type { PlanInfo } from '@funnelorders/shared-types';
import { getConfig, CONFIG_KEYS } from './appConfig.service';

export const PLANS: PlanInfo[] = [
  {
    tier: 'STARTER',
    name: 'Starter',
    price: 29.99,
    ordersPerMonth: 500,
    features: ['2 inbound integrations', '1 outbound integration', 'Basic routing', '1 store'],
  },
  {
    tier: 'GROWTH',
    name: 'Growth',
    price: 49.99,
    ordersPerMonth: 2500,
    features: [
      '3 inbound integrations',
      '2 outbound integrations',
      'Conditional routing rules',
      'Priority support',
      'Up to 5 stores',
    ],
  },
  {
    tier: 'AGENCY',
    name: 'Agency',
    price: 97.99,
    ordersPerMonth: null,
    features: [
      'All platforms',
      'Unlimited rules',
      'White-label',
      'API access',
      'Unlimited stores',
    ],
  },
];

/** maxStores per plan tier */
const PLAN_MAX_STORES: Record<string, number> = {
  FREE: 1,
  STARTER: 1,
  GROWTH: 5,
  AGENCY: 999,
};

async function getPriceId(tier: string): Promise<string> {
  // Try AppConfig first, fall back to env vars
  let priceId: string | null = null;
  switch (tier) {
    case 'STARTER':
      priceId = await getConfig(CONFIG_KEYS.STRIPE_PRICE_STARTER);
      return priceId ?? config.STRIPE_PRICE_STARTER;
    case 'GROWTH':
      priceId = await getConfig(CONFIG_KEYS.STRIPE_PRICE_GROWTH);
      // Fall back to STRIPE_PRICE_GROWTH env var if set, otherwise error
      if (!priceId) {
        const envGrowth = process.env['STRIPE_PRICE_GROWTH'];
        if (envGrowth) return envGrowth;
        throw new AppError('INVALID_PLAN', 'No price configured for GROWTH plan. Run /admin/stripe/sync-prices first.', 400);
      }
      return priceId;
    case 'AGENCY':
      priceId = await getConfig(CONFIG_KEYS.STRIPE_PRICE_AGENCY);
      return priceId ?? config.STRIPE_PRICE_AGENCY;
    default:
      throw new AppError('INVALID_PLAN', 'Invalid plan tier', 400);
  }
}

export async function createCheckoutSession(userId: string, planTier: string): Promise<string> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError('NOT_FOUND', 'User not found', 404);

  let customerId = user.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      name: `${user.firstName} ${user.lastName}`,
      metadata: { userId },
    });
    customerId = customer.id;
    await prisma.user.update({ where: { id: userId }, data: { stripeCustomerId: customerId } });
  }

  const priceId = await getPriceId(planTier);
  // If the user is still in their trial window, carry the remaining days into Stripe
  const user2 = await prisma.user.findUnique({ where: { id: userId } });
  const trialDaysRemaining =
    user2?.trialEndsAt && user2.trialEndsAt > new Date()
      ? Math.ceil((user2.trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : 0;

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    ...(trialDaysRemaining > 0 && {
      subscription_data: { trial_period_days: trialDaysRemaining },
    }),
    success_url: `${config.APP_URL}/settings/billing?success=1`,
    cancel_url: `${config.APP_URL}/settings/billing?canceled=1`,
    metadata: { userId, planTier },
  });

  return session.url!;
}

export async function createPortalSession(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.stripeCustomerId) throw new AppError('NOT_FOUND', 'No billing account found', 404);

  const session = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${config.APP_URL}/settings/billing`,
  });

  return session.url;
}

export async function getSubscription(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError('NOT_FOUND', 'User not found', 404);

  return {
    subscriptionStatus: user.subscriptionStatus,
    planTier: user.planTier,
    planCurrentPeriodEnd: user.planCurrentPeriodEnd,
    stripeCustomerId: user.stripeCustomerId,
    maxStores: user.maxStores,
  };
}

export async function handleStripeEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const { userId, planTier } = session.metadata ?? {};
      if (!userId || !planTier) break;

      const maxStores = PLAN_MAX_STORES[planTier] ?? 1;
      await prisma.user.update({
        where: { id: userId },
        data: {
          subscriptionStatus: 'ACTIVE',
          planTier: planTier as never,
          subscriptionId: session.subscription as string,
          maxStores,
        },
      });
      await createAuditLog({ userId, action: 'SUBSCRIPTION_ACTIVATED', metadata: { planTier } as Record<string, unknown> });
      break;
    }

    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription;
      const user = await prisma.user.findFirst({ where: { subscriptionId: sub.id } });
      if (!user) break;

      await prisma.user.update({
        where: { id: user.id },
        data: {
          subscriptionStatus: mapStripeStatus(sub.status),
          planCurrentPeriodEnd: new Date(sub.current_period_end * 1000),
        },
      });
      break;
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;
      const user = await prisma.user.findFirst({ where: { subscriptionId: sub.id } });
      if (!user) break;

      await prisma.user.update({
        where: { id: user.id },
        data: { subscriptionStatus: 'CANCELED', planTier: 'FREE', maxStores: 1 },
      });
      await createAuditLog({ userId: user.id, action: 'SUBSCRIPTION_CANCELED' });
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;
      const user = await prisma.user.findFirst({ where: { stripeCustomerId: invoice.customer as string } });
      if (!user) break;

      await prisma.user.update({ where: { id: user.id }, data: { subscriptionStatus: 'PAST_DUE' } });
      await createAuditLog({ userId: user.id, action: 'PAYMENT_FAILED' });
      break;
    }

    case 'invoice.payment_succeeded': {
      const invoice = event.data.object as Stripe.Invoice;
      const user = await prisma.user.findFirst({ where: { stripeCustomerId: invoice.customer as string } });
      if (!user) break;

      await prisma.user.update({
        where: { id: user.id },
        data: {
          subscriptionStatus: 'ACTIVE',
          planCurrentPeriodEnd: invoice.lines.data[0]?.period.end
            ? new Date(invoice.lines.data[0].period.end * 1000)
            : undefined,
        },
      });
      break;
    }

    default:
      logger.debug('Unhandled Stripe event', { type: event.type });
  }
}

function mapStripeStatus(status: string): 'ACTIVE' | 'INACTIVE' | 'PAST_DUE' | 'CANCELED' | 'TRIALING' {
  const map: Record<string, 'ACTIVE' | 'INACTIVE' | 'PAST_DUE' | 'CANCELED' | 'TRIALING'> = {
    active: 'ACTIVE',
    trialing: 'TRIALING',
    past_due: 'PAST_DUE',
    canceled: 'CANCELED',
    unpaid: 'PAST_DUE',
    incomplete: 'INACTIVE',
    incomplete_expired: 'INACTIVE',
  };
  return map[status] ?? 'INACTIVE';
}
