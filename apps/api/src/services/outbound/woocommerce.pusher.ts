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

export async function pushToWooCommerce(order: Order, routingLogId: string): Promise<string> {
  const integration = await prisma.integration.findFirst({
    where: { userId: order.userId, platform: 'WOOCOMMERCE', status: { in: ['CONNECTED', 'DISCONNECTED'] } },
  });
  if (!integration) throw new Error('No WooCommerce integration found for this user');

  const creds: { storeUrl: string; consumerKey: string; consumerSecret: string } = JSON.parse(
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
  const mapped = applyMappings(orderForMapping, customMappings, 'WOOCOMMERCE');
  const billing = buildNestedFromMappings(mapped, 'billing');
  const shipping = buildNestedFromMappings(mapped, 'shipping');
  const customerNote = mapped['customer_note'] ?? '';

  const payload = {
    status: 'processing',
    currency: order.currency,
    billing: Object.keys(billing).length > 0 ? billing : {
      first_name: order.customerFirstName,
      last_name: order.customerLastName,
      email: order.customerEmail,
      phone: order.customerPhone ?? '',
    },
    shipping: Object.keys(shipping).length > 0 ? shipping : undefined,
    customer_note: customerNote,
    // Use fee_lines for external orders — WooCommerce 7+ requires product_id/SKU on line_items
    // which external orders don't have. Fee lines accept arbitrary name+amount.
    fee_lines: lineItems.map((item) => ({
      name: item.quantity > 1 ? `${item.name} (x${item.quantity})` : item.name,
      total: item.total.toFixed(2),
      tax_class: '',
    })),
    meta_data: [
      { key: '_funnelorders_id', value: order.id },
      { key: '_funnelorders_source', value: order.source },
    ],
  };

  logger.info('WooCommerce order payload', { payload: JSON.stringify(payload) });

  let response;
  try {
    response = await axios.post(`${creds.storeUrl}/wp-json/wc/v3/orders`, payload, {
      auth: { username: creds.consumerKey, password: creds.consumerSecret },
      timeout: 30000,
    });
  } catch (err: unknown) {
    const axiosErr = err as { response?: { status?: number; data?: unknown } };
    logger.error('WooCommerce API error', {
      status: axiosErr.response?.status,
      data: JSON.stringify(axiosErr.response?.data),
    });
    throw new Error(
      `WooCommerce ${axiosErr.response?.status ?? 'network'} error: ${JSON.stringify(axiosErr.response?.data ?? 'no response')}`
    );
  }

  const externalId = String(response.data.id);

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

  logger.info('WooCommerce order created', { orderId: order.id, externalId });
  return externalId;
}
