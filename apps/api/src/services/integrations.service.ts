import { prisma } from '../lib/prisma';
import { encrypt, decrypt } from '../lib/encryption';
import { AppError } from '../utils/AppError';
import { createAuditLog } from '../middleware/auditLog.middleware';
import { nanoid } from 'nanoid';
import { config } from '../lib/env';
import axios from 'axios';

const INBOUND_PLATFORMS = ['CLICKFUNNELS', 'GHL', 'KARTRA'];
const OUTBOUND_PLATFORMS = ['WOOCOMMERCE', 'SHOPIFY'];

export async function listIntegrations(userId: string, storeId?: string) {
  const where = storeId ? { storeId } : { userId };
  const integrations = await prisma.integration.findMany({
    where,
    orderBy: { createdAt: 'asc' },
  });
  return integrations.map(redactCredentials);
}

export async function getIntegration(userId: string, id: string, storeId?: string) {
  const where = storeId ? { id, storeId } : { id, userId };
  const integration = await prisma.integration.findFirst({ where });
  if (!integration) throw new AppError('NOT_FOUND', 'Integration not found', 404);
  return redactCredentials(integration);
}

export async function createIntegration(
  userId: string,
  platform: string,
  credentials: Record<string, string>,
  label?: string,
  storeId?: string,
) {
  const existingWhere = storeId ? { storeId, platform: platform as never } : { userId, platform: platform as never };
  const existing = await prisma.integration.findFirst({ where: existingWhere });
  if (existing) throw new AppError('ALREADY_EXISTS', 'Integration for this platform already exists', 409);

  const direction = INBOUND_PLATFORMS.includes(platform) ? 'INBOUND' : 'OUTBOUND';
  const encryptedCreds = encrypt(JSON.stringify(credentials));

  let webhookUrl: string | undefined;
  let webhookSecret: string | undefined;

  if (direction === 'INBOUND') {
    const token = nanoid(32);
    webhookSecret = nanoid(32);
    webhookUrl = `${config.API_URL}/api/v1/webhooks/${platform.toLowerCase()}/${userId}/${token}`;

    // Webhook-only platforms (e.g. ClickFunnels) are immediately CONNECTED — URL is live
    const webhookOnlyPlatforms = ['CLICKFUNNELS'];
    const initialStatus = webhookOnlyPlatforms.includes(platform) ? 'CONNECTED' : 'DISCONNECTED';

    const integration = await prisma.integration.create({
      data: {
        userId,
        ...(storeId && { storeId }),
        platform: platform as never,
        direction: direction as never,
        label,
        credentials: encryptedCreds,
        webhookSecret,
        webhookUrl,
        status: initialStatus as never,
      },
    });

    await prisma.webhookEndpoint.create({
      data: {
        userId,
        ...(storeId && { storeId }),
        integrationId: integration.id,
        path: `/webhooks/${platform.toLowerCase()}/${userId}/${token}`,
        secret: webhookSecret,
      },
    });

    await createAuditLog({ userId, action: 'INTEGRATION_CREATED', entityType: 'Integration', entityId: integration.id, metadata: { platform } as Record<string, unknown> });
    return redactCredentials({ ...integration, webhookUrl });
  }

  const integration = await prisma.integration.create({
    data: {
      userId,
      ...(storeId && { storeId }),
      platform: platform as never,
      direction: direction as never,
      label,
      credentials: encryptedCreds,
      status: 'DISCONNECTED',
    },
  });

  await createAuditLog({ userId, action: 'INTEGRATION_CREATED', entityType: 'Integration', entityId: integration.id, metadata: { platform } as Record<string, unknown> });
  return redactCredentials(integration);
}

export async function updateIntegration(
  userId: string,
  id: string,
  credentials: Record<string, string>,
  label?: string,
  storeId?: string,
) {
  const where = storeId ? { id, storeId } : { id, userId };
  const integration = await prisma.integration.findFirst({ where });
  if (!integration) throw new AppError('NOT_FOUND', 'Integration not found', 404);

  const encryptedCreds = encrypt(JSON.stringify(credentials));
  const updated = await prisma.integration.update({
    where: { id },
    data: { credentials: encryptedCreds, ...(label !== undefined && { label }) },
  });

  await createAuditLog({ userId, action: 'INTEGRATION_UPDATED', entityType: 'Integration', entityId: id });
  return redactCredentials(updated);
}

export async function deleteIntegration(userId: string, id: string, storeId?: string) {
  const where = storeId ? { id, storeId } : { id, userId };
  const integration = await prisma.integration.findFirst({ where });
  if (!integration) throw new AppError('NOT_FOUND', 'Integration not found', 404);

  // Delete child records first to avoid FK constraint violations
  await prisma.webhookEndpoint.deleteMany({ where: { integrationId: id } });
  await prisma.integration.delete({ where: { id } });
  await createAuditLog({ userId, action: 'INTEGRATION_DELETED', entityType: 'Integration', entityId: id });
}

export async function testIntegration(userId: string, id: string, storeId?: string): Promise<{ success: boolean; message: string }> {
  const where = storeId ? { id, storeId } : { id, userId };
  const integration = await prisma.integration.findFirst({ where });
  if (!integration) throw new AppError('NOT_FOUND', 'Integration not found', 404);

  let creds: Record<string, string>;
  try {
    creds = JSON.parse(decrypt(integration.credentials as string));
  } catch {
    throw new AppError('DECRYPTION_ERROR', 'Failed to decrypt credentials', 500);
  }

  try {
    await testConnection(integration.platform, creds);
    await prisma.integration.update({
      where: { id },
      data: { status: 'CONNECTED', lastTestedAt: new Date(), errorMessage: null },
    });
    return { success: true, message: 'Connection successful' };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Connection failed';
    await prisma.integration.update({
      where: { id },
      data: { status: 'ERROR', lastTestedAt: new Date(), errorMessage: msg },
    });
    return { success: false, message: msg };
  }
}

export async function getDecryptedCredentials(integration: { credentials: unknown }): Promise<Record<string, string>> {
  return JSON.parse(decrypt(integration.credentials as string));
}

export async function saveFieldMappings(
  userId: string,
  id: string,
  mappings: Record<string, string>,
  storeId?: string,
) {
  const where = storeId ? { id, storeId } : { id, userId };
  const integration = await prisma.integration.findFirst({ where });
  if (!integration) throw new AppError('NOT_FOUND', 'Integration not found', 404);
  return prisma.integration.update({
    where: { id },
    data: { fieldMappings: mappings as never },
  });
}

async function testConnection(platform: string, creds: Record<string, string>): Promise<void> {
  switch (platform) {
    case 'WOOCOMMERCE': {
      const { storeUrl, consumerKey, consumerSecret } = creds as Record<string, string>;
      await axios.get(`${storeUrl}/wp-json/wc/v3/system_status`, {
        auth: { username: consumerKey ?? '', password: consumerSecret ?? '' },
        timeout: 10000,
      });
      break;
    }
    case 'SHOPIFY': {
      const { storeDomain, adminApiToken } = creds as Record<string, string>;
      await axios.get(`https://${storeDomain}/admin/api/2024-01/shop.json`, {
        headers: { 'X-Shopify-Access-Token': adminApiToken ?? '' },
        timeout: 10000,
      });
      break;
    }
    case 'CLICKFUNNELS':
      // Webhook-based: no API call needed — URL is ready for CF to POST to
      break;
    default:
      // GHL, Kartra: assume success if creds provided
      if (Object.keys(creds).length === 0) throw new Error('No credentials provided');
  }
}

function redactCredentials<T extends { credentials: unknown }>(integration: T): Omit<T, 'credentials'> & { credentials: string } {
  return { ...integration, credentials: '[REDACTED]' };
}
