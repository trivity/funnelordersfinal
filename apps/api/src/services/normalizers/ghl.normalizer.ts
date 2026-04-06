import type { NormalizedOrder } from '@funnelorders/shared-types';
import { AppError } from '../../utils/AppError';

export function normalizeGHL(payload: unknown): NormalizedOrder {
  const data = payload as Record<string, unknown>;
  const contact = data['contact'] as Record<string, unknown> | undefined;
  const order = (data['order'] ?? data) as Record<string, unknown>;

  if (!contact?.['email'] && !order['email']) {
    throw new AppError('NORMALIZER_ERROR', 'Missing required GHL fields', 400);
  }

  const items = (order['items'] as Array<Record<string, unknown>> | undefined) ?? [];
  const subtotal = items.reduce((sum, item) => {
    return sum + Number(item['price'] ?? 0) * Number(item['qty'] ?? item['quantity'] ?? 1);
  }, 0);

  return {
    externalId: String(order['id'] ?? `ghl-${Date.now()}`),
    source: 'GHL',
    customerEmail: String(contact?.['email'] ?? order['email'] ?? ''),
    customerFirstName: String(contact?.['firstName'] ?? contact?.['first_name'] ?? ''),
    customerLastName: String(contact?.['lastName'] ?? contact?.['last_name'] ?? ''),
    customerPhone: contact?.['phone'] ? String(contact['phone']) : undefined,
    shippingAddress: contact
      ? {
          line1: String(contact['address1'] ?? ''),
          city: String(contact['city'] ?? ''),
          state: String(contact['state'] ?? ''),
          zip: String(contact['postalCode'] ?? contact['postal_code'] ?? ''),
          country: String(contact['country'] ?? 'US'),
        }
      : undefined,
    lineItems: items.map((item) => ({
      name: String(item['name'] ?? 'Product'),
      sku: item['sku'] ? String(item['sku']) : undefined,
      quantity: Number(item['qty'] ?? item['quantity'] ?? 1),
      unitPrice: Number(item['price'] ?? 0),
      total: Number(item['price'] ?? 0) * Number(item['qty'] ?? item['quantity'] ?? 1),
      productId: item['product_id'] ? String(item['product_id']) : undefined,
    })),
    subtotal,
    total: Number(order['totalAmount'] ?? order['total_amount'] ?? subtotal),
    currency: String(order['currency'] ?? 'USD'),
    rawPayload: payload,
  };
}
