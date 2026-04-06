import { Worker } from 'bullmq';
import { redis } from '../../lib/redis';
import { logger } from '../../lib/logger';
import { prisma } from '../../lib/prisma';
import { pushToWooCommerce } from '../../services/outbound/woocommerce.pusher';
import { pushToShopify } from '../../services/outbound/shopify.pusher';
import type { OutboundPushJob } from '../queues';

export function startOutboundPushWorker() {
  const worker = new Worker<OutboundPushJob>(
    'outbound-push',
    async (job) => {
      const { orderId, destination, routingLogId, userId, storeId } = job.data;
      logger.info('Processing outbound push job', { jobId: job.id, orderId, destination });

      // Mark as in progress (OrderRoutingLog is not user-scoped in middleware)
      await prisma.orderRoutingLog.update({
        where: { id: routingLogId },
        data: {
          status: 'IN_PROGRESS',
          attemptCount: { increment: job.attemptsMade > 0 ? 1 : 0 },
          lastAttemptAt: new Date(),
        },
      });

      // Use storeId or userId in where clause to satisfy multi-tenant middleware
      const orderWhere = storeId ? { id: orderId, storeId } : { id: orderId, userId };
      const order = await prisma.order.findFirst({ where: orderWhere });
      if (!order) throw new Error(`Order ${orderId} not found`);

      try {
        switch (destination) {
          case 'WOOCOMMERCE':
            await pushToWooCommerce(order, routingLogId);
            break;
          case 'SHOPIFY':
            await pushToShopify(order, routingLogId);
            break;
          default:
            throw new Error(`Unknown destination: ${destination}`);
        }

        // Update order status
        const allLogs = await prisma.orderRoutingLog.findMany({ where: { orderId } });
        const allSuccess = allLogs.every((l) => l.status === 'SUCCESS');
        const anySuccess = allLogs.some((l) => l.status === 'SUCCESS');
        await prisma.order.update({
          where: { id: orderId },
          data: { status: allSuccess ? 'ROUTED' : anySuccess ? 'PARTIALLY_ROUTED' : 'PROCESSING' },
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        await prisma.orderRoutingLog.update({
          where: { id: routingLogId },
          data: {
            status: job.attemptsMade < (job.opts.attempts ?? 5) - 1 ? 'RETRYING' : 'FAILED',
            errorMessage: msg,
            lastAttemptAt: new Date(),
            attemptCount: { increment: 1 },
          },
        });

        // Mark order FAILED if all logs failed
        const allLogs = await prisma.orderRoutingLog.findMany({ where: { orderId } });
        const allFailed = allLogs.every((l) => l.status === 'FAILED');
        if (allFailed) {
          await prisma.order.update({ where: { id: orderId }, data: { status: 'FAILED' } });
        }

        throw err; // Re-throw so BullMQ can handle retry
      }
    },
    { connection: redis, concurrency: 10 },
  );

  worker.on('failed', (job, err) => {
    logger.error('Outbound push job failed permanently', {
      jobId: job?.id,
      destination: job?.data.destination,
      error: err.message,
    });
  });

  return worker;
}
