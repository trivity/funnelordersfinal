import { Queue } from 'bullmq';
import { redis } from '../lib/redis';

export const webhookProcessingQueue = new Queue('webhook-processing', {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: { count: 100 },
    removeOnFail: false,
  },
});

export const outboundPushQueue = new Queue('outbound-push', {
  connection: redis,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: { count: 100 },
    removeOnFail: false,
  },
});

export interface WebhookJob {
  platform: string;
  userId: string;
  storeId?: string;
  integrationId: string;
  payload: unknown;
  rawBody: string;
}

export interface OutboundPushJob {
  orderId: string;
  destination: string;
  routingLogId: string;
  userId: string;
  storeId?: string;
}

export async function enqueueWebhookProcessing(data: WebhookJob): Promise<void> {
  await webhookProcessingQueue.add('process', data);
}

export async function enqueueOutboundPush(
  orderId: string,
  destination: string,
  routingLogId: string,
  userId: string,
  storeId?: string,
): Promise<void> {
  await outboundPushQueue.add('push', { orderId, destination, routingLogId, userId, storeId });
}
