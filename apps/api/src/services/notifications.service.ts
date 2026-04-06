import axios from 'axios';
import { prisma } from '../lib/prisma';
import { sendRoutingFailureEmail } from '../lib/email';
import { logger } from '../lib/logger';
import { config } from '../lib/env';

export async function notifyRoutingFailure(
  userId: string,
  orderId: string,
  destination: string,
  errorMessage: string,
): Promise<void> {
  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.notifyOnFailure) return;

    const tasks: Promise<void>[] = [];
    const emailTo = (user.alertEmail as string | null) || user.email;

    // Email alert
    tasks.push(
      sendRoutingFailureEmail(emailTo, {
        orderId,
        destination,
        errorMessage,
        firstName: user.firstName,
      }).catch((err: unknown) => {
        logger.error('Failed to send routing failure email', { error: (err as Error).message, userId, orderId });
      }),
    );

    // Slack alert
    if (user.slackWebhookUrl) {
      tasks.push(
        sendSlackAlert(user.slackWebhookUrl as string, { orderId, destination, errorMessage }).catch((err: unknown) => {
          logger.error('Failed to send Slack alert', { error: (err as Error).message, userId, orderId });
        }),
      );
    }

    await Promise.allSettled(tasks);
  } catch (err: unknown) {
    logger.error('notifyRoutingFailure error', { error: (err as Error).message, userId, orderId });
  }
}

async function sendSlackAlert(
  webhookUrl: string,
  data: { orderId: string; destination: string; errorMessage: string },
): Promise<void> {
  const shortId = data.orderId.slice(0, 8).toUpperCase();
  await axios.post(webhookUrl, {
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: '⚠️ FunnelOrders: Routing Failed', emoji: true },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Order ID*\n\`${shortId}...\`` },
          { type: 'mrkdwn', text: `*Destination*\n${data.destination}` },
        ],
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `*Error*\n${data.errorMessage}` },
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: 'View Orders', emoji: true },
            url: `${config.APP_URL}/orders`,
            style: 'primary',
          },
        ],
      },
    ],
  });
}
