import 'dotenv/config';
import { createApp } from './app';
import { config } from './lib/env';
import { logger } from './lib/logger';
import { startWebhookProcessorWorker } from './jobs/workers/webhookProcessor.worker';
import { startOutboundPushWorker } from './jobs/workers/outboundPush.worker';
import { prisma } from './lib/prisma';

async function main() {
  // Verify DB connection
  await prisma.$connect();
  logger.info('Database connected');

  // Start BullMQ workers
  startWebhookProcessorWorker();
  startOutboundPushWorker();
  logger.info('BullMQ workers started');

  // Start server
  const app = createApp();
  app.listen(config.PORT, () => {
    logger.info(`API server running on port ${config.PORT}`, {
      env: config.NODE_ENV,
      port: config.PORT,
    });
  });
}

main().catch((err) => {
  logger.error('Fatal startup error', err);
  process.exit(1);
});
