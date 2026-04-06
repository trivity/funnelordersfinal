import type { NormalizedOrder } from '@funnelorders/shared-types';
import { AppError } from '../../utils/AppError';

// ClickFunnels v2 webhook payload shape (actual production format)
// payload.data = order object containing contact, line_items, currency, id
export function normalizeClickFunnels(payload: unknown): NormalizedOrder {
  const root = payload as Record<string, unknown>;

  // CF v2 wraps everything under "data"
  const order = (root['data'] ?? root) as Record<string, unknown>;
  const contact = order['contact'] as Record<string, unknown> | undefined;

  const email = String(contact?.['email_address'] ?? contact?.['email'] ?? '');
  if (!email) {
    throw new AppError('NORMALIZER_ERROR', 'Missing required ClickFunnels fields (email)', 400);
  }

  // Shipping address — CF puts it on the order or contact
  const shippingRaw =
    (order['shipping_address'] ?? contact?.['shipping_address']) as Record<string, unknown> | undefined;

  const shippingAddress = shippingRaw
    ? {
        line1: String(shippingRaw['address1'] ?? shippingRaw['line1'] ?? shippingRaw['street'] ?? ''),
        line2: shippingRaw['address2'] ? String(shippingRaw['address2']) : undefined,
        city: String(shippingRaw['city'] ?? ''),
        state: String(shippingRaw['state'] ?? ''),
        zip: String(shippingRaw['zip'] ?? shippingRaw['postal_code'] ?? ''),
        country: String(shippingRaw['country'] ?? 'US'),
      }
    : undefined;

  // Line items — directly on the order object
  const lineItemsRaw = (order['line_items'] as Array<Record<string, unknown>> | undefined) ?? [];

  const lineItems = lineItemsRaw.map((item) => {
    // Price: products_price.amount is a string like "5.00"
    const priceRaw = item['products_price'] as Record<string, unknown> | undefined;
    const unitPrice = priceRaw?.['amount']
      ? parseFloat(String(priceRaw['amount']))
      : (Number(item['price_cents'] ?? item['amount'] ?? 0) / 100);

    // Name: original_product.name or products_variant.name or fallback
    const productRaw = item['original_product'] as Record<string, unknown> | undefined;
    const variantRaw = item['products_variant'] as Record<string, unknown> | undefined;
    const name = String(
      productRaw?.['name'] ?? variantRaw?.['name'] ?? item['name'] ?? 'Product'
    );

    const qty = Number(item['quantity'] ?? 1);

    return {
      name,
      sku: item['sku'] ? String(item['sku']) : undefined,
      quantity: qty,
      unitPrice,
      total: unitPrice * qty,
      productId: productRaw?.['id'] ? String(productRaw['id']) : undefined,
    };
  });

  const subtotal = lineItems.reduce((sum, i) => sum + i.total, 0);

  // Total: order_total or order_total_cents or sum of line items
  const totalRaw = order['order_total'] ?? order['total'];
  const totalCents = order['order_total_cents'];
  const total = totalRaw
    ? parseFloat(String(totalRaw))
    : totalCents
      ? Number(totalCents) / 100
      : subtotal;

  return {
    externalId: String(order['id'] ?? order['public_id'] ?? `cf-${Date.now()}`),
    source: 'CLICKFUNNELS',
    customerEmail: email,
    customerFirstName: String(contact?.['first_name'] ?? ''),
    customerLastName: String(contact?.['last_name'] ?? ''),
    customerPhone: contact?.['phone_number']
      ? String(contact['phone_number'])
      : contact?.['phone']
        ? String(contact['phone'])
        : undefined,
    shippingAddress,
    lineItems,
    subtotal,
    total,
    currency: String(order['currency'] ?? 'USD').toUpperCase(),
    rawPayload: payload,
  };
}
