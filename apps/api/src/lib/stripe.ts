import Stripe from 'stripe';
import { config } from './env';
import { getConfig, CONFIG_KEYS } from '../services/appConfig.service';

const API_VERSION = '2025-02-24.acacia' as const;

let cached: { key: string; client: Stripe } | null = null;

export async function getStripe(): Promise<Stripe> {
  const key = (await getConfig(CONFIG_KEYS.STRIPE_SECRET_KEY)) ?? config.STRIPE_SECRET_KEY;
  if (cached && cached.key === key) return cached.client;
  const client = new Stripe(key, { apiVersion: API_VERSION });
  cached = { key, client };
  return client;
}

export async function getStripeWebhookSecret(): Promise<string> {
  return (await getConfig(CONFIG_KEYS.STRIPE_WEBHOOK_SECRET)) ?? config.STRIPE_WEBHOOK_SECRET;
}

/** Clears cached client after admin updates Stripe keys */
export function resetStripeClient(): void {
  cached = null;
}
