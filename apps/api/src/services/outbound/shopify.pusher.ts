import axios from 'axios';
import { prisma } from '../../lib/prisma';
import { decrypt } from '../../lib/encryption';
import { logger } from '../../lib/logger';
import type { Order } from '@prisma/client';
import type { OrderLineItem, Address } from '@funnelorders/shared-types';
import { applyMappings } from '../fieldMapping.service';

function flattenShippingAddress(shippingAddress: unknown): Record<string, unknown> {
  if (!shippingAddress || typeof shippingAddress !== 'object') return {};
  const addr = shippingAddress as Address;
  return {
    'shippingAddress.line1': addr.line1 ?? '',
    'shippingAddress.line2': addr.line2 ?? '',
    'shippingAddress.city': addr.city ?? '',
    'shippingAddress.state': addr.state ?? '',
    'shippingAddress.zip': addr.zip ?? '',
    'shippingAddress.country': addr.country ?? '',
  };
}

function flattenBillingAddress(billingAddress: unknown): Record<string, unknown> {
  if (!billingAddress || typeof billingAddress !== 'object') return {};
  const addr = billingAddress as Address;
  return {
    'billingAddress.line1': addr.line1 ?? '',
    'billingAddress.line2': addr.line2 ?? '',
    'billingAddress.city': addr.city ?? '',
    'billingAddress.state': addr.state ?? '',
    'billingAddress.zip': addr.zip ?? '',
    'billingAddress.country': addr.country ?? '',
  };
}

function buildNestedFromMappings(mapped: Record<string, string>, prefix: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, val] of Object.entries(mapped)) {
    if (key.startsWith(`${prefix}.`)) {
      result[key.slice(prefix.length + 1)] = val;
    }
  }
  return result;
}

export async function pushToShopify(order: Order, routingLogId: string): Promise<string> {
  const integration = await prisma.integration.findFirst({
    where: { userId: order.userId, platform: 'SHOPIFY', status: 'CONNECTED' },
  });
  if (!integration) throw new Error('No connected Shopify integration found');

  const creds: { storeDomain: string; adminApiToken: string } = JSON.parse(
    decrypt(integration.credentials as string),
  );

  const lineItems = order.lineItems as unknown as OrderLineItem[];

  const orderForMapping: Record<string, unknown> = {
    customerFirstName: order.customerFirstName,
    customerLastName: order.customerLastName,
    customerEmail: order.customerEmail,
    customerPhone: order.customerPhone,
    total: order.total,
    subtotal: order.subtotal,
    tax: order.tax,
    shipping: order.shipping,
    currency: order.currency,
    notes: order.notes,
    ...flattenShippingAddress(order.shippingAddress),
    ...flattenBillingAddress(order.billingAddress),
  };

  const customMappings = (integration.fieldMappings ?? {}) as Record<string, string>;
  const mapped = applyMappings(orderForMapping, customMappings, 'SHOPIFY');

  const shippingMapped = buildNestedFromMappings(mapped, 'shipping_address');
  const billingMapped = buildNestedFromMappings(mapped, 'billing_address');
  const customerMapped = buildNestedFromMappings(mapped, 'customer');
  const note = mapped['note'] ?? '';

  // Fall back to original address objects if mappings produced nothing
  const billing = order.billingAddress as unknown as Address | null;
  const shipping = order.shippingAddress as unknown as Address | null;

  const billingAddress = Object.keys(billingMapped).length > 0
    ? billingMapped
    : billing
      ? {
          first_name: order.customerFirstName,
          last_name: order.customerLastName,
          address1: billing.line1,
          address2: billing.line2 ?? '',
          city: billing.city,
          province: billing.state,
          zip: billing.zip,
          country: billing.country,
          phone: order.customerPhone ?? '',
        }
      : undefined;

  const shippingAddress = Object.keys(shippingMapped).length > 0
    ? shippingMapped
    : shipping
      ? {
          first_name: order.customerFirstName,
          last_name: order.customerLastName,
          address1: shipping.line1,
          address2: shipping.line2 ?? '',
          city: shipping.city,
          province: shipping.state,
          zip: shipping.zip,
          country: shipping.country,
          phone: order.customerPhone ?? '',
        }
      : undefined;

  const payload = {
    order: {
      email: customerMapped['email'] ?? order.customerEmail,
      financial_status: 'paid',
      currency: order.currency,
      note: note || undefined,
      line_items: lineItems.map((item) => ({
        title: item.name,
        quantity: item.quantity,
        price: item.unitPrice.toFixed(2),
        sku: item.sku ?? '',
      })),
      billing_address: billingAddress,
      shipping_address: shippingAddress,
      note_attributes: [
        { name: 'funnelorders_id', value: order.id },
        { name: 'funnelorders_source', value: order.source },
      ],
    },
  };

  const response = await axios.post(
    `https://${creds.storeDomain}/admin/api/2024-01/orders.json`,
    payload,
    {
      headers: { 'X-Shopify-Access-Token': creds.adminApiToken },
      timeout: 30000,
    },
  );

  const externalId = String(response.data.order.id);

  await prisma.orderRoutingLog.update({
    where: { id: routingLogId },
    data: {
      status: 'SUCCESS',
      externalOrderId: externalId,
      responsePayload: response.data as never,
      requestPayload: payload as never,
      succeededAt: new Date(),
    },
  });

  await prisma.integration.update({
    where: { id: integration.id },
    data: { lastUsedAt: new Date() },
  });

  logger.info('Shopify order created', { orderId: order.id, externalId });
  return externalId;
}
