// Types previously from @funnelorders/shared-types — inlined to remove workspace dependency

export type Role = 'USER' | 'ADMIN';
export type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'DELETED';
export type SubscriptionStatus = 'ACTIVE' | 'INACTIVE' | 'PAST_DUE' | 'CANCELED' | 'TRIALING';
export type PlanTier = 'FREE' | 'STARTER' | 'GROWTH' | 'AGENCY';

export type OrderSource = 'CLICKFUNNELS' | 'GHL' | 'KARTRA' | 'MANUAL';
export type OrderStatus =
  | 'RECEIVED'
  | 'PROCESSING'
  | 'ROUTED'
  | 'PARTIALLY_ROUTED'
  | 'FAILED'
  | 'ARCHIVED';

export type OrderDestination = 'WOOCOMMERCE' | 'SHOPIFY';
export type RoutingStatus = 'PENDING' | 'IN_PROGRESS' | 'SUCCESS' | 'FAILED' | 'RETRYING';

export type IntegrationPlatform =
  | 'CLICKFUNNELS'
  | 'GHL'
  | 'KARTRA'
  | 'WOOCOMMERCE'
  | 'SHOPIFY';
export type IntegrationDirection = 'INBOUND' | 'OUTBOUND';
export type IntegrationStatus = 'CONNECTED' | 'DISCONNECTED' | 'ERROR';

export interface Address {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

export interface OrderLineItem {
  id?: string;
  sku?: string;
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
  productId?: string;
}

export interface NormalizedOrder {
  externalId: string;
  source: OrderSource;
  customerEmail: string;
  customerFirstName: string;
  customerLastName: string;
  customerPhone?: string;
  shippingAddress?: Address;
  billingAddress?: Address;
  lineItems: OrderLineItem[];
  subtotal: number;
  tax?: number;
  shipping?: number;
  total: number;
  currency: string;
  rawPayload: unknown;
}

export interface RuleCondition {
  field: 'total' | 'customerEmail' | 'tag' | 'productName';
  operator: 'gt' | 'lt' | 'eq' | 'contains' | 'not_contains';
  value: string | number;
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface PaginatedResponse<T> {
  success: true;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface PlanInfo {
  tier: PlanTier;
  name: string;
  price: number;
  ordersPerMonth: number | null;
  features: string[];
  stripePriceId?: string;
}
