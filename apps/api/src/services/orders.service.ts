import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError } from '../utils/AppError';
import { createAuditLog } from '../middleware/auditLog.middleware';
import type { NormalizedOrder } from '@funnelorders/shared-types';

export async function listOrders(
  userId: string,
  opts: {
    page: number;
    limit: number;
    skip: number;
    status?: string;
    source?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
    storeId?: string;
  },
) {
  // When scoped to a store, also include orders with storeId: null that belong to the user
  const where: Prisma.OrderWhereInput = opts.storeId
    ? { OR: [{ storeId: opts.storeId }, { storeId: null, userId }] }
    : { userId };
  // If a specific status is requested use it; otherwise exclude ARCHIVED from the main list
  if (opts.status) {
    where.status = opts.status as never;
  } else {
    where.status = { not: 'ARCHIVED' } as never;
  }
  if (opts.source) where.source = opts.source as never;
  if (opts.startDate || opts.endDate) {
    where.receivedAt = {
      ...(opts.startDate && { gte: new Date(opts.startDate) }),
      ...(opts.endDate && { lte: new Date(opts.endDate) }),
    };
  }
  if (opts.search) {
    where.OR = [
      { customerEmail: { contains: opts.search, mode: 'insensitive' } },
      { customerFirstName: { contains: opts.search, mode: 'insensitive' } },
      { customerLastName: { contains: opts.search, mode: 'insensitive' } },
      { id: { contains: opts.search } },
    ];
  }

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { receivedAt: 'desc' },
      skip: opts.skip,
      take: opts.limit,
      include: { routingLogs: { orderBy: { createdAt: 'desc' }, take: 1 } },
    }),
    prisma.order.count({ where }),
  ]);

  return { orders, total };
}

export async function getOrder(userId: string, orderId: string, storeId?: string) {
  const where = storeId ? { id: orderId, storeId } : { id: orderId, userId };
  const order = await prisma.order.findFirst({
    where,
    include: { routingLogs: { orderBy: { createdAt: 'desc' } } },
  });
  if (!order) throw new AppError('NOT_FOUND', 'Order not found', 404);
  return order;
}

export async function createManualOrder(
  userId: string,
  data: Omit<NormalizedOrder, 'rawPayload' | 'externalId'>,
  storeId?: string,
) {
  const order = await prisma.order.create({
    data: {
      userId,
      ...(storeId && { storeId }),
      source: 'MANUAL',
      customerEmail: data.customerEmail,
      customerFirstName: data.customerFirstName,
      customerLastName: data.customerLastName,
      customerPhone: data.customerPhone,
      shippingAddress: data.shippingAddress ? (JSON.parse(JSON.stringify(data.shippingAddress)) as Prisma.InputJsonValue) : undefined,
      billingAddress: data.billingAddress ? (JSON.parse(JSON.stringify(data.billingAddress)) as Prisma.InputJsonValue) : undefined,
      lineItems: JSON.parse(JSON.stringify(data.lineItems)) as Prisma.InputJsonValue,
      subtotal: data.subtotal,
      tax: data.tax,
      shipping: data.shipping,
      total: data.total,
      currency: data.currency,
    },
  });
  await createAuditLog({ userId, action: 'ORDER_CREATED', entityType: 'Order', entityId: order.id });
  return order;
}

export async function patchOrder(
  userId: string,
  orderId: string,
  data: { notes?: string; tags?: string[]; status?: string },
  storeId?: string,
) {
  const where = storeId ? { id: orderId, storeId } : { id: orderId, userId };
  const order = await prisma.order.findFirst({ where });
  if (!order) throw new AppError('NOT_FOUND', 'Order not found', 404);

  const updated = await prisma.order.update({
    where: { id: orderId },
    data: {
      ...(data.notes !== undefined && { notes: data.notes }),
      ...(data.tags !== undefined && { tags: data.tags }),
      ...(data.status !== undefined && { status: data.status as never }),
    },
  });
  await createAuditLog({ userId, action: 'ORDER_UPDATED', entityType: 'Order', entityId: orderId, metadata: data as Record<string, unknown> });
  return updated;
}

export async function archiveOrder(userId: string, orderId: string, storeId?: string) {
  const where = storeId ? { id: orderId, storeId } : { id: orderId, userId };
  const order = await prisma.order.findFirst({ where });
  if (!order) throw new AppError('NOT_FOUND', 'Order not found', 404);

  const updated = await prisma.order.update({
    where: { id: orderId },
    data: { status: 'ARCHIVED' },
  });
  await createAuditLog({ userId, action: 'ORDER_ARCHIVED', entityType: 'Order', entityId: orderId });
  return updated;
}

export async function getOrderStats(userId: string, storeId?: string) {
  const scope = storeId ? { storeId } : { userId };
  const [total, byStatus, bySource] = await Promise.all([
    prisma.order.count({ where: scope }),
    prisma.order.groupBy({ by: ['status'], where: scope, _count: true }),
    prisma.order.groupBy({ by: ['source'], where: scope, _count: true }),
  ]);

  // Last 30 days volume
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recent = await prisma.order.findMany({
    where: { ...scope, receivedAt: { gte: thirtyDaysAgo } },
    select: { receivedAt: true, total: true },
    orderBy: { receivedAt: 'asc' },
  });

  return {
    total,
    byStatus: byStatus.map((s) => ({ status: s.status, count: s._count })),
    bySource: bySource.map((s) => ({ source: s.source, count: s._count })),
    recentOrders: recent,
  };
}

export async function createOrderFromNormalized(userId: string, order: NormalizedOrder, storeId?: string) {
  // Idempotency check
  const idempotencyWhere = storeId
    ? { storeId, externalId: order.externalId, source: order.source as never }
    : { userId, externalId: order.externalId, source: order.source as never };
  const existing = await prisma.order.findFirst({ where: idempotencyWhere });
  if (existing) return { order: existing, isDuplicate: true };

  const created = await prisma.order.create({
    data: {
      userId,
      ...(storeId && { storeId }),
      externalId: order.externalId,
      source: order.source as never,
      customerEmail: order.customerEmail,
      customerFirstName: order.customerFirstName,
      customerLastName: order.customerLastName,
      customerPhone: order.customerPhone,
      shippingAddress: order.shippingAddress ? (JSON.parse(JSON.stringify(order.shippingAddress)) as Prisma.InputJsonValue) : undefined,
      billingAddress: order.billingAddress ? (JSON.parse(JSON.stringify(order.billingAddress)) as Prisma.InputJsonValue) : undefined,
      lineItems: JSON.parse(JSON.stringify(order.lineItems)) as Prisma.InputJsonValue,
      subtotal: order.subtotal,
      tax: order.tax,
      shipping: order.shipping,
      total: order.total,
      currency: order.currency,
      rawPayload: order.rawPayload ? (JSON.parse(JSON.stringify(order.rawPayload)) as Prisma.InputJsonValue) : undefined,
      status: 'RECEIVED',
    },
  });

  await createAuditLog({
    userId,
    action: 'ORDER_CREATED',
    entityType: 'Order',
    entityId: created.id,
    metadata: { source: order.source, externalId: order.externalId } as Record<string, unknown>,
  });

  return { order: created, isDuplicate: false };
}
