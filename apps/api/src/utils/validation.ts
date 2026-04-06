import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordSchema = z.object({
  token: z.string(),
  password: z.string().min(8).max(128),
});

export const createOrderSchema = z.object({
  customerEmail: z.string().email(),
  customerFirstName: z.string().min(1),
  customerLastName: z.string().min(1),
  customerPhone: z.string().optional(),
  shippingAddress: z
    .object({
      line1: z.string(),
      line2: z.string().optional(),
      city: z.string(),
      state: z.string(),
      zip: z.string(),
      country: z.string().length(2),
    })
    .optional(),
  billingAddress: z
    .object({
      line1: z.string(),
      line2: z.string().optional(),
      city: z.string(),
      state: z.string(),
      zip: z.string(),
      country: z.string().length(2),
    })
    .optional(),
  lineItems: z.array(
    z.object({
      sku: z.string().optional(),
      name: z.string(),
      quantity: z.number().int().positive(),
      unitPrice: z.number().nonnegative(),
      total: z.number().nonnegative(),
      productId: z.string().optional(),
    }),
  ).min(1),
  subtotal: z.number().nonnegative(),
  tax: z.number().nonnegative().optional(),
  shipping: z.number().nonnegative().optional(),
  total: z.number().nonnegative(),
  currency: z.string().default('USD'),
  notes: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export const patchOrderSchema = z.object({
  notes: z.string().optional(),
  tags: z.array(z.string()).optional(),
  status: z.enum(['RECEIVED', 'PROCESSING', 'ROUTED', 'PARTIALLY_ROUTED', 'FAILED', 'ARCHIVED']).optional(),
});

export const createIntegrationSchema = z.object({
  platform: z.enum(['CLICKFUNNELS', 'GHL', 'KARTRA', 'WOOCOMMERCE', 'SHOPIFY']),
  credentials: z.record(z.string()),
  label: z.string().optional(),
});

export const createRoutingRuleSchema = z.object({
  name: z.string().min(1).max(200),
  sourceFilter: z.enum(['CLICKFUNNELS', 'GHL', 'KARTRA', 'MANUAL']).nullable().optional(),
  conditions: z.array(
    z.object({
      field: z.enum(['total', 'customerEmail', 'tag', 'productName']),
      operator: z.enum(['gt', 'lt', 'eq', 'contains', 'not_contains']),
      value: z.union([z.string(), z.number()]),
    }),
  ).default([]),
  destination: z.enum(['WOOCOMMERCE', 'SHOPIFY']).optional(),
  destinations: z.array(z.enum(['WOOCOMMERCE', 'SHOPIFY'])).min(1).optional(),
  active: z.boolean().default(true),
  priority: z.number().int().default(0),
}).refine((d) => d.destination || (d.destinations && d.destinations.length > 0), {
  message: 'At least one destination is required',
});

export const pushOrderSchema = z.object({
  destination: z.enum(['WOOCOMMERCE', 'SHOPIFY']),
});

export const reorderRulesSchema = z.object({
  orderedIds: z.array(z.string().uuid()),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string(),
  newPassword: z.string().min(8).max(128),
});

export const updateProfileSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
});

export function validate<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const { AppError } = require('./AppError');
    throw new AppError('VALIDATION_ERROR', 'Validation failed', 400, result.error.flatten());
  }
  return result.data;
}
