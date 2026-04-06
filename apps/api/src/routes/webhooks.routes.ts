import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { verifyHmacSha256 } from '../utils/webhookSignature';
import { enqueueWebhookProcessing } from '../jobs/queues';
import { logger } from '../lib/logger';

const router = Router();

// Raw body is parsed in app.ts for /webhooks/* paths
async function handleWebhook(
  req: Request,
  res: Response,
  next: NextFunction,
  platform: string,
): Promise<void> {
  try {
    const { userId, token } = req.params as { userId: string; token: string };

    // Find the webhook endpoint
    const endpoint = await prisma.webhookEndpoint.findFirst({
      where: {
        path: `/webhooks/${platform}/${userId}/${token}`,
        active: true,
        userId,
      },
      include: { integration: true },
    });

    if (!endpoint) {
      res.status(404).json({ error: 'Webhook endpoint not found' });
      return;
    }

    // Verify HMAC signature
    const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
    const signature =
      req.headers['x-cf-signature'] ??
      req.headers['x-ghl-signature'] ??
      req.headers['x-kartra-token'] ??
      '';

    if (rawBody && signature) {
      const valid = verifyHmacSha256(rawBody, String(signature), endpoint.secret);
      if (!valid) {
        logger.warn('Invalid webhook signature', { platform, userId });
        res.status(401).json({ error: 'Invalid signature' });
        return;
      }
    }

    // Respond immediately
    res.status(200).json({ received: true });

    // Update endpoint stats (update is a write op — bypasses userId middleware)
    await prisma.webhookEndpoint.update({
      where: { id: endpoint.id },
      data: { receivedCount: { increment: 1 }, lastReceivedAt: new Date() },
    }).catch((e: Error) => logger.warn('Failed to update endpoint stats', { error: e.message }));

    // Parse payload from rawBody (req.body is empty since JSON parser is skipped for webhook routes)
    const rawBodyStr = rawBody?.toString('utf8') ?? '{}';
    let payload: unknown = {};
    try { payload = JSON.parse(rawBodyStr); } catch { payload = {}; }

    // Queue for async processing
    await enqueueWebhookProcessing({
      platform,
      userId,
      integrationId: endpoint.integrationId,
      payload,
      rawBody: rawBodyStr,
    });
  } catch (err) {
    next(err);
  }
}

router.post('/clickfunnels/:userId/:token', (req, res, next) =>
  handleWebhook(req, res, next, 'clickfunnels'),
);

router.post('/ghl/:userId/:token', (req, res, next) =>
  handleWebhook(req, res, next, 'ghl'),
);

router.post('/kartra/:userId/:token', (req, res, next) =>
  handleWebhook(req, res, next, 'kartra'),
);

export default router;
