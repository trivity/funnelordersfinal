import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import type { OrderLineItem } from '@funnelorders/shared-types';

export interface SalesAnalyticsFilters {
  storeId?: string;
  source?: string;
  product?: string;
  startDate?: string;
  endDate?: string;
}

function parseLineItems(raw: unknown): OrderLineItem[] {
  if (!Array.isArray(raw)) return [];
  return raw as OrderLineItem[];
}

function orderHasProduct(lineItems: unknown, product: string): boolean {
  const needle = product.toLowerCase();
  return parseLineItems(lineItems).some((item) => item.name.toLowerCase().includes(needle));
}

function toNumber(value: Prisma.Decimal | number): number {
  return typeof value === 'number' ? value : Number(value);
}

export async function getSalesAnalytics(userId: string, filters: SalesAnalyticsFilters) {
  const where: Prisma.OrderWhereInput = {
    userId,
    status: { not: 'ARCHIVED' },
    ...(filters.storeId && { storeId: filters.storeId }),
    ...(filters.source && { source: filters.source as never }),
    ...(filters.startDate || filters.endDate
      ? {
          receivedAt: {
            ...(filters.startDate && { gte: new Date(filters.startDate) }),
            ...(filters.endDate && { lte: new Date(filters.endDate) }),
          },
        }
      : {}),
  };

  const [orders, stores] = await Promise.all([
    prisma.order.findMany({
      where,
      select: {
        id: true,
        storeId: true,
        source: true,
        total: true,
        receivedAt: true,
        lineItems: true,
        store: { select: { id: true, name: true } },
      },
      orderBy: { receivedAt: 'desc' },
    }),
    prisma.store.findMany({
      where: { userId },
      select: { id: true, name: true },
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  const filteredOrders = filters.product
    ? orders.filter((order) => orderHasProduct(order.lineItems, filters.product!))
    : orders;

  let totalRevenue = 0;
  const byStoreMap = new Map<string, { storeId: string; storeName: string; revenue: number; orders: number }>();
  const bySourceMap = new Map<string, { source: string; revenue: number; orders: number }>();
  const byProductMap = new Map<string, { product: string; revenue: number; quantity: number; orders: number }>();
  const byDayMap = new Map<string, { date: string; revenue: number; orders: number }>();

  for (const order of filteredOrders) {
    const revenue = toNumber(order.total);
    totalRevenue += revenue;

    const storeKey = order.storeId ?? 'unassigned';
    const storeName = order.store?.name ?? 'Unassigned';
    const storeEntry = byStoreMap.get(storeKey) ?? { storeId: storeKey, storeName, revenue: 0, orders: 0 };
    storeEntry.revenue += revenue;
    storeEntry.orders += 1;
    byStoreMap.set(storeKey, storeEntry);

    const sourceEntry = bySourceMap.get(order.source) ?? { source: order.source, revenue: 0, orders: 0 };
    sourceEntry.revenue += revenue;
    sourceEntry.orders += 1;
    bySourceMap.set(order.source, sourceEntry);

    const day = order.receivedAt.toISOString().slice(0, 10);
    const dayEntry = byDayMap.get(day) ?? { date: day, revenue: 0, orders: 0 };
    dayEntry.revenue += revenue;
    dayEntry.orders += 1;
    byDayMap.set(day, dayEntry);

    const seenProducts = new Set<string>();
    for (const item of parseLineItems(order.lineItems)) {
      const key = item.name.trim() || 'Unknown product';
      const productEntry = byProductMap.get(key) ?? { product: key, revenue: 0, quantity: 0, orders: 0 };
      productEntry.revenue += item.total ?? item.unitPrice * item.quantity;
      productEntry.quantity += item.quantity;
      if (!seenProducts.has(key)) {
        productEntry.orders += 1;
        seenProducts.add(key);
      }
      byProductMap.set(key, productEntry);
    }
  }

  const totalOrders = filteredOrders.length;
  const productSet = new Set<string>();
  for (const order of orders) {
    for (const item of parseLineItems(order.lineItems)) {
      if (item.name.trim()) productSet.add(item.name.trim());
    }
  }

  const sourceSet = new Set(orders.map((o) => o.source));

  return {
    summary: {
      totalRevenue,
      totalOrders,
      avgOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0,
    },
    byStore: [...byStoreMap.values()].sort((a, b) => b.revenue - a.revenue),
    bySource: [...bySourceMap.values()].sort((a, b) => b.revenue - a.revenue),
    byProduct: [...byProductMap.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 25),
    timeSeries: [...byDayMap.values()].sort((a, b) => a.date.localeCompare(b.date)),
    filterOptions: {
      stores,
      sources: [...sourceSet].sort(),
      products: [...productSet].sort((a, b) => a.localeCompare(b)),
    },
  };
}
