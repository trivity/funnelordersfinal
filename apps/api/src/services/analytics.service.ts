import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import type { OrderLineItem } from '@funnelorders/shared-types';

export interface AnalyticsFilters {
  storeId?: string;
  source?: string;
  product?: string;
  startDate?: string;
  endDate?: string;
}

type OrderRow = {
  id: string;
  storeId: string | null;
  source: string;
  status: string;
  customerEmail: string;
  customerFirstName: string;
  customerLastName: string;
  subtotal: Prisma.Decimal;
  tax: Prisma.Decimal | null;
  shipping: Prisma.Decimal | null;
  total: Prisma.Decimal;
  receivedAt: Date;
  lineItems: unknown;
  store: { id: string; name: string } | null;
};

function parseLineItems(raw: unknown): OrderLineItem[] {
  if (!Array.isArray(raw)) return [];
  return raw as OrderLineItem[];
}

function orderHasProduct(lineItems: unknown, product: string): boolean {
  const needle = product.toLowerCase();
  return parseLineItems(lineItems).some((item) => item.name.toLowerCase().includes(needle));
}

function toNumber(value: Prisma.Decimal | number | null | undefined): number {
  if (value == null) return 0;
  return typeof value === 'number' ? value : Number(value);
}

function customerName(order: OrderRow): string {
  return `${order.customerFirstName} ${order.customerLastName}`.trim() || order.customerEmail;
}

function monthKey(date: Date): string {
  return date.toISOString().slice(0, 7);
}

function buildWhere(userId: string, filters: AnalyticsFilters, includeArchived = false): Prisma.OrderWhereInput {
  return {
    userId,
    ...(includeArchived ? {} : { status: { not: 'ARCHIVED' } }),
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
}

export async function getAnalyticsOverview(userId: string, filters: AnalyticsFilters) {
  const [activeOrders, archivedOrders, stores] = await Promise.all([
    prisma.order.findMany({
      where: buildWhere(userId, filters, false),
      select: {
        id: true,
        storeId: true,
        source: true,
        status: true,
        customerEmail: true,
        customerFirstName: true,
        customerLastName: true,
        subtotal: true,
        tax: true,
        shipping: true,
        total: true,
        receivedAt: true,
        lineItems: true,
        store: { select: { id: true, name: true } },
      },
      orderBy: { receivedAt: 'desc' },
    }),
    prisma.order.findMany({
      where: { ...buildWhere(userId, filters, true), status: 'ARCHIVED' },
      select: { total: true, receivedAt: true },
    }),
    prisma.store.findMany({
      where: { userId },
      select: { id: true, name: true },
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  const orders = (filters.product
    ? activeOrders.filter((o) => orderHasProduct(o.lineItems, filters.product!))
    : activeOrders) as OrderRow[];

  // ─── Sales aggregates ─────────────────────────────────────────────────────
  let totalRevenue = 0;
  const byDayMap = new Map<string, { date: string; revenue: number; orders: number }>();
  const byMonthMap = new Map<string, { month: string; revenue: number; orders: number }>();
  const byStoreMap = new Map<string, { storeId: string; storeName: string; revenue: number; orders: number }>();
  const bySourceMap = new Map<string, { channel: string; revenue: number; orders: number }>();
  const byProductMap = new Map<string, { product: string; revenue: number; revenueExShipping: number; quantity: number; orders: number }>();
  const byCustomerSalesMap = new Map<string, { name: string; email: string; revenue: number; orders: number }>();

  // ─── Customer aggregates ──────────────────────────────────────────────────
  const customerOrdersMap = new Map<string, { email: string; name: string; orders: OrderRow[] }>();

  // ─── Finance aggregates ───────────────────────────────────────────────────
  let grossSales = 0;
  let totalTax = 0;
  let totalShipping = 0;
  let totalDiscounts = 0;

  // ─── Inventory aggregates ─────────────────────────────────────────────────
  const inventoryMap = new Map<string, { product: string; sku: string; unitsSold: number; revenue: number }>();

  for (const order of orders) {
    const revenue = toNumber(order.total);
    const tax = toNumber(order.tax);
    const shipping = toNumber(order.shipping);
    const subtotal = toNumber(order.subtotal);
    const discount = Math.max(0, subtotal + tax + shipping - revenue);

    totalRevenue += revenue;
    grossSales += revenue;
    totalTax += tax;
    totalShipping += shipping;
    totalDiscounts += discount;

    const day = order.receivedAt.toISOString().slice(0, 10);
    const dayEntry = byDayMap.get(day) ?? { date: day, revenue: 0, orders: 0 };
    dayEntry.revenue += revenue;
    dayEntry.orders += 1;
    byDayMap.set(day, dayEntry);

    const month = monthKey(order.receivedAt);
    const monthEntry = byMonthMap.get(month) ?? { month, revenue: 0, orders: 0 };
    monthEntry.revenue += revenue;
    monthEntry.orders += 1;
    byMonthMap.set(month, monthEntry);

    const storeKey = order.storeId ?? 'unassigned';
    const storeName = order.store?.name ?? 'Unassigned';
    const storeEntry = byStoreMap.get(storeKey) ?? { storeId: storeKey, storeName, revenue: 0, orders: 0 };
    storeEntry.revenue += revenue;
    storeEntry.orders += 1;
    byStoreMap.set(storeKey, storeEntry);

    const sourceEntry = bySourceMap.get(order.source) ?? { channel: order.source, revenue: 0, orders: 0 };
    sourceEntry.revenue += revenue;
    sourceEntry.orders += 1;
    bySourceMap.set(order.source, sourceEntry);

    const custKey = order.customerEmail.toLowerCase();
    const custSales = byCustomerSalesMap.get(custKey) ?? {
      name: customerName(order),
      email: order.customerEmail,
      revenue: 0,
      orders: 0,
    };
    custSales.revenue += revenue;
    custSales.orders += 1;
    byCustomerSalesMap.set(custKey, custSales);

    const custRecord = customerOrdersMap.get(custKey) ?? {
      email: order.customerEmail,
      name: customerName(order),
      orders: [],
    };
    custRecord.orders.push(order);
    customerOrdersMap.set(custKey, custRecord);

    const seenProducts = new Set<string>();
    for (const item of parseLineItems(order.lineItems)) {
      const key = item.name.trim() || 'Unknown product';
      const itemRevenue = item.total ?? item.unitPrice * item.quantity;
      const productEntry = byProductMap.get(key) ?? {
        product: key,
        revenue: 0,
        revenueExShipping: 0,
        quantity: 0,
        orders: 0,
      };
      productEntry.revenue += itemRevenue;
      productEntry.revenueExShipping += itemRevenue;
      productEntry.quantity += item.quantity;
      if (!seenProducts.has(key)) {
        productEntry.orders += 1;
        seenProducts.add(key);
      }
      byProductMap.set(key, productEntry);

      const sku = item.sku?.trim() || key;
      const invKey = `${key}::${sku}`;
      const invEntry = inventoryMap.get(invKey) ?? {
        product: key,
        sku,
        unitsSold: 0,
        revenue: 0,
      };
      invEntry.unitsSold += item.quantity;
      invEntry.revenue += itemRevenue;
      inventoryMap.set(invKey, invEntry);
    }
  }

  const totalOrders = orders.length;
  const returns = archivedOrders.reduce((sum, o) => sum + toNumber(o.total), 0);
  const netSales = grossSales - returns;

  // Customer metrics
  const customers = [...customerOrdersMap.values()];
  const totalCustomers = customers.length;
  const returningCustomers = customers.filter((c) => c.orders.length > 1).length;
  const firstTimeCustomers = totalCustomers - returningCustomers;
  const repeatPurchaseRate = totalCustomers > 0 ? (returningCustomers / totalCustomers) * 100 : 0;
  const avgLTV = totalCustomers > 0 ? totalRevenue / totalCustomers : 0;

  const customerBreakdown = customers.map((c) => {
    const revenue = c.orders.reduce((s, o) => s + toNumber(o.total), 0);
    const sorted = [...c.orders].sort((a, b) => a.receivedAt.getTime() - b.receivedAt.getTime());
    return {
      name: c.name,
      email: c.email,
      orders: c.orders.length,
      revenue,
      ltv: revenue,
      firstOrderAt: sorted[0]!.receivedAt.toISOString(),
      lastOrderAt: sorted[sorted.length - 1]!.receivedAt.toISOString(),
      isReturning: c.orders.length > 1,
    };
  });

  // Cohorts by first purchase month
  const cohortMap = new Map<string, { cohort: string; customers: number; revenue: number; orders: number }>();
  for (const c of customers) {
    const sorted = [...c.orders].sort((a, a2) => a.receivedAt.getTime() - a2.receivedAt.getTime());
    const cohort = monthKey(sorted[0]!.receivedAt);
    const revenue = c.orders.reduce((s, o) => s + toNumber(o.total), 0);
    const entry = cohortMap.get(cohort) ?? { cohort, customers: 0, revenue: 0, orders: 0 };
    entry.customers += 1;
    entry.revenue += revenue;
    entry.orders += c.orders.length;
    cohortMap.set(cohort, entry);
  }

  const productSet = new Set<string>();
  const sourceSet = new Set<string>();
  for (const order of activeOrders) {
    sourceSet.add(order.source);
    for (const item of parseLineItems(order.lineItems)) {
      if (item.name.trim()) productSet.add(item.name.trim());
    }
  }

  return {
    filterOptions: {
      stores,
      sources: [...sourceSet].sort(),
      products: [...productSet].sort((a, b) => a.localeCompare(b)),
    },
    sales: {
      summary: {
        revenue: totalRevenue,
        orders: totalOrders,
        avgOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0,
      },
      byDay: [...byDayMap.values()].sort((a, b) => a.date.localeCompare(b.date)),
      byMonth: [...byMonthMap.values()].sort((a, b) => a.month.localeCompare(b.month)),
      byProduct: [...byProductMap.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 25),
      byChannel: [...bySourceMap.values()].sort((a, b) => b.revenue - a.revenue),
      byLocation: [...byStoreMap.values()].sort((a, b) => b.revenue - a.revenue),
      byCustomer: [...byCustomerSalesMap.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 25),
      productExShipping: [...byProductMap.values()]
        .map((p) => ({ product: p.product, revenue: p.revenueExShipping, quantity: p.quantity }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 25),
    },
    customers: {
      summary: {
        totalCustomers,
        firstTimeCustomers,
        returningCustomers,
        repeatPurchaseRate,
        avgLTV,
      },
      cohorts: [...cohortMap.values()].sort((a, b) => a.cohort.localeCompare(b.cohort)),
      breakdown: customerBreakdown.sort((a, b) => b.revenue - a.revenue).slice(0, 50),
    },
    finance: {
      summary: {
        grossSales,
        returns,
        netSales,
        taxes: totalTax,
        shipping: totalShipping,
        discounts: totalDiscounts,
        margin: netSales > 0 ? ((netSales - totalShipping - totalTax) / netSales) * 100 : 0,
      },
      byDay: [...byDayMap.values()].sort((a, b) => a.date.localeCompare(b.date)),
      byMonth: [...byMonthMap.values()].sort((a, b) => a.month.localeCompare(b.month)),
      byProduct: [...byProductMap.values()]
        .map((p) => ({ product: p.product, gross: p.revenueExShipping, shipping: 0 }))
        .sort((a, b) => b.gross - a.gross)
        .slice(0, 25),
      byCustomer: [...byCustomerSalesMap.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 25),
    },
    inventory: {
      summary: {
        trackedProducts: inventoryMap.size,
        totalUnitsSold: [...inventoryMap.values()].reduce((s, i) => s + i.unitsSold, 0),
      },
      products: [...inventoryMap.values()].sort((a, b) => b.unitsSold - a.unitsSold).slice(0, 50),
    },
  };
}

// Keep legacy endpoint shape for backwards compatibility
export async function getSalesAnalytics(userId: string, filters: AnalyticsFilters) {
  const overview = await getAnalyticsOverview(userId, filters);
  return {
    summary: {
      totalRevenue: overview.sales.summary.revenue,
      totalOrders: overview.sales.summary.orders,
      avgOrderValue: overview.sales.summary.avgOrderValue,
    },
    byStore: overview.sales.byLocation.map((l) => ({
      storeId: l.storeId,
      storeName: l.storeName,
      revenue: l.revenue,
      orders: l.orders,
    })),
    bySource: overview.sales.byChannel.map((c) => ({
      source: c.channel,
      revenue: c.revenue,
      orders: c.orders,
    })),
    byProduct: overview.sales.byProduct,
    timeSeries: overview.sales.byDay,
    filterOptions: overview.filterOptions,
  };
}
