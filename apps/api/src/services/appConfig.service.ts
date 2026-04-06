import { prisma } from '../lib/prisma';
import { encrypt, decrypt } from '../lib/encryption';

export const CONFIG_KEYS = {
  STRIPE_SECRET_KEY: 'STRIPE_SECRET_KEY',
  STRIPE_WEBHOOK_SECRET: 'STRIPE_WEBHOOK_SECRET',
  STRIPE_PRICE_STARTER: 'STRIPE_PRICE_STARTER',
  STRIPE_PRICE_GROWTH: 'STRIPE_PRICE_GROWTH',
  STRIPE_PRICE_AGENCY: 'STRIPE_PRICE_AGENCY',
} as const;

export async function getConfig(key: string): Promise<string | null> {
  const record = await prisma.appConfig.findUnique({ where: { key } });
  if (!record) return null;
  return decrypt(record.value);
}

export async function setConfig(key: string, value: string): Promise<void> {
  const encrypted = encrypt(value);
  await prisma.appConfig.upsert({
    where: { key },
    update: { value: encrypted },
    create: { key, value: encrypted },
  });
}

export async function getAllConfigs(): Promise<Record<string, string>> {
  const records = await prisma.appConfig.findMany();
  const result: Record<string, string> = {};
  for (const r of records) {
    try {
      result[r.key] = decrypt(r.value);
    } catch {
      result[r.key] = '';
    }
  }
  return result;
}
