import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

export interface AnalyticsFilters {
  storeId?: string;
  source?: string;
  product?: string;
  startDate?: string;
  endDate?: string;
}

export interface AnalyticsOverview {
  filterOptions: {
    stores: Array<{ id: string; name: string }>;
    sources: string[];
    products: string[];
  };
  sales: {
    summary: { revenue: number; orders: number; avgOrderValue: number };
    byDay: Array<{ date: string; revenue: number; orders: number }>;
    byMonth: Array<{ month: string; revenue: number; orders: number }>;
    byProduct: Array<{ product: string; revenue: number; quantity: number; orders: number }>;
    byChannel: Array<{ channel: string; revenue: number; orders: number }>;
    byLocation: Array<{ storeId: string; storeName: string; revenue: number; orders: number }>;
    byCustomer: Array<{ name: string; email: string; revenue: number; orders: number }>;
    productExShipping: Array<{ product: string; revenue: number; quantity: number }>;
  };
  customers: {
    summary: {
      totalCustomers: number;
      firstTimeCustomers: number;
      returningCustomers: number;
      repeatPurchaseRate: number;
      avgLTV: number;
    };
    cohorts: Array<{ cohort: string; customers: number; revenue: number; orders: number }>;
    breakdown: Array<{
      name: string;
      email: string;
      orders: number;
      revenue: number;
      ltv: number;
      isReturning: boolean;
    }>;
  };
  finance: {
    summary: {
      grossSales: number;
      returns: number;
      netSales: number;
      taxes: number;
      shipping: number;
      discounts: number;
      margin: number;
    };
    byDay: Array<{ date: string; revenue: number; orders: number }>;
    byMonth: Array<{ month: string; revenue: number; orders: number }>;
    byProduct: Array<{ product: string; gross: number; shipping: number }>;
    byCustomer: Array<{ name: string; email: string; revenue: number; orders: number }>;
  };
  inventory: {
    summary: { trackedProducts: number; totalUnitsSold: number };
    products: Array<{ product: string; sku: string; unitsSold: number; revenue: number }>;
  };
}

export function useAnalytics(filters: AnalyticsFilters) {
  return useQuery<AnalyticsOverview>({
    queryKey: ['analytics-overview', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.storeId) params.set('storeId', filters.storeId);
      if (filters.source) params.set('source', filters.source);
      if (filters.product) params.set('product', filters.product);
      if (filters.startDate) params.set('startDate', filters.startDate);
      if (filters.endDate) params.set('endDate', filters.endDate);
      const qs = params.toString();
      const { data } = await api.get(`/analytics/overview${qs ? `?${qs}` : ''}`);
      return data.data as AnalyticsOverview;
    },
  });
}
