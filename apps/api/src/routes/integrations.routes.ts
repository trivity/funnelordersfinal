import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import * as integrationsService from '../services/integrations.service';
import { validate, createIntegrationSchema } from '../utils/validation';
import { success, created } from '../utils/response';
import { autoSuggestFromRawPayload, PLATFORM_DEST_FIELDS, FUNNEL_ORDERS_FIELDS } from '../services/fieldMapping.service';
import { prisma } from '../lib/prisma';

const router = Router();
router.use(authenticate);

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const integrations = await integrationsService.listIntegrations(req.user!.id, req.storeId);
    success(res, integrations);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const integration = await integrationsService.getIntegration(req.user!.id, req.params['id'] as string, req.storeId);
    success(res, integration);
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = validate(createIntegrationSchema, req.body);
    const integration = await integrationsService.createIntegration(
      req.user!.id,
      body.platform,
      body.credentials,
      body.label,
      req.storeId,
    );
    created(res, integration);
  } catch (err) {
    next(err);
  }
});

router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = validate(createIntegrationSchema, req.body);
    const integration = await integrationsService.updateIntegration(
      req.user!.id,
      req.params['id'] as string,
      body.credentials,
      body.label,
      req.storeId,
    );
    success(res, integration);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await integrationsService.deleteIntegration(req.user!.id, req.params['id'] as string, req.storeId);
    success(res, { message: 'Integration deleted' });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/test', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await integrationsService.testIntegration(req.user!.id, req.params['id'] as string, req.storeId);
    success(res, result);
  } catch (err) {
    next(err);
  }
});

router.get('/:id/webhook-url', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const integration = await integrationsService.getIntegration(req.user!.id, req.params['id'] as string, req.storeId);
    success(res, { webhookUrl: (integration as { webhookUrl?: string }).webhookUrl ?? null });
  } catch (err) {
    next(err);
  }
});

// GET /integrations/:id/mapping-suggestions
router.get('/:id/mapping-suggestions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const integration = await integrationsService.getIntegration(req.user!.id, req.params['id'] as string, req.storeId);

    // Get most recent order with rawPayload
    const lastOrder = await prisma.order.findFirst({
      where: req.storeId ? { storeId: req.storeId } : { userId: req.user!.id },
      orderBy: { createdAt: 'desc' },
      select: { rawPayload: true, customerFirstName: true, customerLastName: true, customerEmail: true, customerPhone: true, shippingAddress: true, billingAddress: true, total: true, subtotal: true, tax: true, shipping: true, currency: true, notes: true },
    });

    const rawPayload = (lastOrder?.rawPayload ?? {}) as Record<string, unknown>;
    const { suggestions, sampleValues } = autoSuggestFromRawPayload(rawPayload, integration.platform);

    // Build sample values from order fields directly too
    if (lastOrder) {
      const orderSamples: Record<string, unknown> = {
        customerFirstName: lastOrder.customerFirstName,
        customerLastName: lastOrder.customerLastName,
        customerEmail: lastOrder.customerEmail,
        customerPhone: lastOrder.customerPhone,
        total: lastOrder.total,
        subtotal: lastOrder.subtotal,
        tax: lastOrder.tax,
        shipping: lastOrder.shipping,
        currency: lastOrder.currency,
        notes: lastOrder.notes,
        ...((lastOrder.shippingAddress as Record<string, unknown> | null) ?
          Object.fromEntries(Object.entries(lastOrder.shippingAddress as Record<string, unknown>).map(([k, v]) => [`shippingAddress.${k}`, v])) : {}),
        ...((lastOrder.billingAddress as Record<string, unknown> | null) ?
          Object.fromEntries(Object.entries(lastOrder.billingAddress as Record<string, unknown>).map(([k, v]) => [`billingAddress.${k}`, v])) : {}),
      };
      for (const [key, val] of Object.entries(orderSamples)) {
        if (val && !sampleValues[key]) sampleValues[key] = String(val).substring(0, 100);
      }
    }

    // Current saved mappings on integration
    const currentMappings = (integration.fieldMappings ?? {}) as Record<string, string>;
    const effectiveSuggestions = Object.keys(currentMappings).length > 0 ? currentMappings : suggestions;

    success(res, {
      platform: integration.platform,
      suggestions: effectiveSuggestions,
      sampleValues,
      destFields: PLATFORM_DEST_FIELDS[integration.platform] ?? [],
      sourceFields: FUNNEL_ORDERS_FIELDS,
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /integrations/:id/mappings
router.patch('/:id/mappings', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { mappings } = req.body as { mappings: Record<string, string> };
    await integrationsService.saveFieldMappings(req.user!.id, req.params['id'] as string, mappings, req.storeId);
    success(res, { saved: true });
  } catch (err) {
    next(err);
  }
});

export default router;
