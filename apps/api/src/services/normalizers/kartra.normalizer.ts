import type { NormalizedOrder } from '@funnelorders/shared-types';
import { AppError } from '../../utils/AppError';

export function normalizeKartra(payload: unknown): NormalizedOrder {
  const data = payload as Record<string, unknown>;
  const member = data['member'] as Record<string, unknown> | undefined;
  const transaction = data['transaction'] as Record<string, unknown> | undefined;
  const product = data['product'] as Record<string, unknown> | undefined;

  if (!member?.['email']) {
    throw new AppError('NORMALIZER_ERROR', 'Missing required Kartra fields', 400);
  }

  const price = Number(transaction?.['amount'] ?? product?.['price'] ?? 0);

  return {
    externalId: String(transaction?.['id'] ?? `kartra-${Date.now()}`),
    source: 'KARTRA',
    customerEmail: String(member['email']),
    customerFirstName: String(member['first_name'] ?? ''),
    customerLastName: String(member['last_name'] ?? ''),
    customerPhone: member['phone'] ? String(member['phone']) : undefined,
    shippingAddress: member['address']
      ? {
          line1: String((member['address'] as Record<string, unknown>)['street'] ?? ''),
          city: String((member['address'] as Record<string, unknown>)['city'] ?? ''),
          state: String((member['address'] as Record<string, unknown>)['state'] ?? ''),
          zip: String((member['address'] as Record<string, unknown>)['zip'] ?? ''),
          country: String((member['address'] as Record<string, unknown>)['country'] ?? 'US'),
        }
      : undefined,
    lineItems: [
      {
        name: String(product?.['name'] ?? 'Product'),
        sku: product?.['sku'] ? String(product['sku']) : undefined,
        quantity: 1,
        unitPrice: price,
        total: price,
        productId: product?.['id'] ? String(product['id']) : undefined,
      },
    ],
    subtotal: price,
    total: price,
    currency: String(transaction?.['currency'] ?? 'USD'),
    rawPayload: payload,
  };
}
