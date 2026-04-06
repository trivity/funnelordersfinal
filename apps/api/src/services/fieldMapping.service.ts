/**
 * Field mapping service
 * Maps FunnelOrders canonical fields -> platform-specific destination fields
 */

// Canonical FunnelOrders source fields with labels and example paths
export const FUNNEL_ORDERS_FIELDS = [
  { key: 'customerFirstName', label: 'First Name' },
  { key: 'customerLastName', label: 'Last Name' },
  { key: 'customerEmail', label: 'Email' },
  { key: 'customerPhone', label: 'Phone' },
  { key: 'shippingAddress.firstName', label: 'Shipping First Name' },
  { key: 'shippingAddress.lastName', label: 'Shipping Last Name' },
  { key: 'shippingAddress.line1', label: 'Shipping Address Line 1' },
  { key: 'shippingAddress.line2', label: 'Shipping Address Line 2' },
  { key: 'shippingAddress.city', label: 'Shipping City' },
  { key: 'shippingAddress.state', label: 'Shipping State' },
  { key: 'shippingAddress.zip', label: 'Shipping Zip' },
  { key: 'shippingAddress.country', label: 'Shipping Country' },
  { key: 'billingAddress.firstName', label: 'Billing First Name' },
  { key: 'billingAddress.lastName', label: 'Billing Last Name' },
  { key: 'billingAddress.line1', label: 'Billing Address Line 1' },
  { key: 'billingAddress.city', label: 'Billing City' },
  { key: 'billingAddress.state', label: 'Billing State' },
  { key: 'billingAddress.zip', label: 'Billing Zip' },
  { key: 'billingAddress.country', label: 'Billing Country' },
  { key: 'total', label: 'Order Total' },
  { key: 'subtotal', label: 'Subtotal' },
  { key: 'tax', label: 'Tax' },
  { key: 'shipping', label: 'Shipping Cost' },
  { key: 'currency', label: 'Currency' },
  { key: 'notes', label: 'Order Notes' },
];

// Default mappings per platform: destinationField -> sourceField
export const DEFAULT_MAPPINGS: Record<string, Record<string, string>> = {
  WOOCOMMERCE: {
    'billing.first_name': 'customerFirstName',
    'billing.last_name': 'customerLastName',
    'billing.email': 'customerEmail',
    'billing.phone': 'customerPhone',
    'billing.address_1': 'billingAddress.line1',
    'billing.city': 'billingAddress.city',
    'billing.state': 'billingAddress.state',
    'billing.postcode': 'billingAddress.zip',
    'billing.country': 'billingAddress.country',
    'shipping.first_name': 'shippingAddress.firstName',
    'shipping.last_name': 'shippingAddress.lastName',
    'shipping.address_1': 'shippingAddress.line1',
    'shipping.address_2': 'shippingAddress.line2',
    'shipping.city': 'shippingAddress.city',
    'shipping.state': 'shippingAddress.state',
    'shipping.postcode': 'shippingAddress.zip',
    'shipping.country': 'shippingAddress.country',
    'customer_note': 'notes',
  },
  SHOPIFY: {
    'shipping_address.first_name': 'shippingAddress.firstName',
    'shipping_address.last_name': 'shippingAddress.lastName',
    'shipping_address.address1': 'shippingAddress.line1',
    'shipping_address.address2': 'shippingAddress.line2',
    'shipping_address.city': 'shippingAddress.city',
    'shipping_address.province': 'shippingAddress.state',
    'shipping_address.zip': 'shippingAddress.zip',
    'shipping_address.country': 'shippingAddress.country',
    'billing_address.first_name': 'billingAddress.firstName',
    'billing_address.last_name': 'billingAddress.lastName',
    'billing_address.address1': 'billingAddress.line1',
    'billing_address.city': 'billingAddress.city',
    'billing_address.province': 'billingAddress.state',
    'billing_address.zip': 'billingAddress.zip',
    'billing_address.country': 'billingAddress.country',
    'customer.email': 'customerEmail',
    'customer.phone': 'customerPhone',
    'note': 'notes',
  },
};

// Destination fields available per platform
export const PLATFORM_DEST_FIELDS: Record<string, string[]> = {
  WOOCOMMERCE: [
    'billing.first_name', 'billing.last_name', 'billing.email', 'billing.phone',
    'billing.address_1', 'billing.address_2', 'billing.city', 'billing.state',
    'billing.postcode', 'billing.country',
    'shipping.first_name', 'shipping.last_name', 'shipping.address_1', 'shipping.address_2',
    'shipping.city', 'shipping.state', 'shipping.postcode', 'shipping.country',
    'customer_note',
  ],
  SHOPIFY: [
    'shipping_address.first_name', 'shipping_address.last_name',
    'shipping_address.address1', 'shipping_address.address2',
    'shipping_address.city', 'shipping_address.province',
    'shipping_address.zip', 'shipping_address.country',
    'billing_address.first_name', 'billing_address.last_name',
    'billing_address.address1', 'billing_address.address2',
    'billing_address.city', 'billing_address.province',
    'billing_address.zip', 'billing_address.country',
    'customer.email', 'customer.phone', 'note',
  ],
};

/**
 * Get nested value from object using dot notation
 */
export function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[key];
    return undefined;
  }, obj);
}

/**
 * Auto-suggest field mappings by fuzzy-matching raw payload keys against FunnelOrders fields.
 * Returns a map of: sourceField -> detectedValue (from raw payload)
 */
export function autoSuggestFromRawPayload(
  rawPayload: Record<string, unknown>,
  platform: string,
): { suggestions: Record<string, string>; sampleValues: Record<string, string> } {
  const defaults = DEFAULT_MAPPINGS[platform] ?? {};

  // Invert defaults: sourceField -> destField
  const suggestions: Record<string, string> = {};
  for (const [dest, src] of Object.entries(defaults)) {
    suggestions[src] = dest;
  }

  // Extract sample values from raw payload using fuzzy key matching
  const sampleValues: Record<string, string> = {};
  const flatPayload = flattenObject(rawPayload);

  for (const field of FUNNEL_ORDERS_FIELDS) {
    const key = field.key.toLowerCase().replace(/\./g, '_').replace(/address/g, 'addr');
    for (const [flatKey, val] of Object.entries(flatPayload)) {
      const normalizedKey = flatKey.toLowerCase().replace(/[^a-z0-9]/g, '_');
      if (normalizedKey.includes(key.split('_')[0] ?? '') && val) {
        sampleValues[field.key] = String(val).substring(0, 100);
        break;
      }
    }
  }

  return { suggestions, sampleValues };
}

/**
 * Flatten nested object to dot-notation keys
 */
export function flattenObject(obj: unknown, prefix = ''): Record<string, unknown> {
  if (!obj || typeof obj !== 'object') return {};
  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(obj as Record<string, unknown>)) {
    const newKey = prefix ? `${prefix}.${key}` : key;
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      Object.assign(result, flattenObject(val, newKey));
    } else {
      result[newKey] = val;
    }
  }
  return result;
}

/**
 * Apply field mappings to extract a value from an order for a given source field key.
 * mapping: { sourceField -> destField } stored on integration
 * This returns: { destField -> value } for use in building the push payload
 */
export function applyMappings(
  order: Record<string, unknown>,
  customMappings: Record<string, string>, // sourceField -> destField
  platform: string,
): Record<string, string> {
  const effectiveMappings = {
    ...invertMappings(DEFAULT_MAPPINGS[platform] ?? {}), // sourceField -> destField defaults
    ...customMappings, // user overrides
  };

  const result: Record<string, string> = {};
  for (const [srcField, destField] of Object.entries(effectiveMappings)) {
    const val = getNestedValue(order, srcField);
    if (val !== undefined && val !== null && val !== '') {
      result[destField] = String(val);
    }
  }
  return result;
}

function invertMappings(m: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [dest, src] of Object.entries(m)) out[src] = dest;
  return out;
}
