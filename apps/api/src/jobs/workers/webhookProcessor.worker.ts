import { Worker } from 'bullmq';
import { redis } from '../../lib/redis';
import { logger } from '../../lib/logger';
import { normalizeClickFunnels } from '../../services/normalizers/clickfunnels.normalizer';
import { normalizeGHL } from '../../services/normalizers/ghl.normalizer';
import { normalizeKartra } from '../../services/normalizers/kartra.normalizer';
import { createOrderFromNormalized } from '../../services/orders.service';
import { evaluateRoutingRules } from '../../services/routing.service';
import type { WebhookJob } from '../queues';

export function startWebhookProcessorWorker() {
  const worker = new Worker<WebhookJob>(
    'webhook-processing',
    async (job) => {
      const { platform, userId, storeId, payload } = job.data;
      logger.info('Processing webhook job', { jobId: job.id, platform, userId, storeId });

      // Log payload for debugging normalizer issues
      logger.info('Webhook raw payload', { platform, payload: JSON.stringify(payload).slice(0, 2000) });

      let normalized;
      switch (platform.toUpperCase()) {
        case 'CLICKFUNNELS':
          normalized = normalizeClickFunnels(payload);
          break;
        case 'GHL':
          normalized = normalizeGHL(payload);
          break;
        case 'KARTRA':
          normalized = normalizeKartra(payload);
          break;
        default:
          throw new Error(`Unknown platform: ${platform}`);
      }

      const { order, isDuplicate } = await createOrderFromNormalized(userId, normalized, storeId);
      if (isDuplicate) {
        logger.warn('Duplicate webhook, skipping routing', { externalId: normalized.externalId });
        return;
      }

      await evaluateRoutingRules(userId, order.id, {
        source: order.source,
        total: Number(order.total),
        customerEmail: order.customerEmail,
        tags: order.tags,
        lineItems: order.lineItems as Array<{ name: string }>,
        storeId,
      });

      logger.info('Webhook processed successfully', { orderId: order.id });
    },
    { connection: redis, concurrency: 5 },
  );

  worker.on('failed', (job, err) => {
    logger.error('Webhook job failed', { jobId: job?.id, error: err.message });
  });

  return worker;
}
