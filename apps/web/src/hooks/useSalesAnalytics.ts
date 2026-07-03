import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

export interface SalesAnalytics {
  summary: {
    totalRevenue: number;
    totalOrders: number;
    avgOrderValue: number;
  };
  byStore: Array<{ storeId: string; storeName: string; revenue: number; orders: number }>;
  bySource: Array<{ source: string; revenue: number; orders: number }>;
  byProduct: Array<{ product: string; revenue: number; quantity: number; orders: number }>;
  timeSeries: Array<{ date: string; revenue: number; orders: number }>;
  filterOptions: {
    stores: Array<{ id: string; name: string }>;
    sources: string[];
    products: string[];
  };
}

export interface SalesAnalyticsFilters {
  storeId?: string;
  source?: string;
  product?: string;
  startDate?: string;
  endDate?: string;
}

export function useSalesAnalytics(filters: SalesAnalyticsFilters) {
  return useQuery<SalesAnalytics>({
    queryKey: ['sales-analytics', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.storeId) params.set('storeId', filters.storeId);
      if (filters.source) params.set('source', filters.source);
      if (filters.product) params.set('product', filters.product);
      if (filters.startDate) params.set('startDate', filters.startDate);
      if (filters.endDate) params.set('endDate', filters.endDate);
      const qs = params.toString();
      const { data } = await api.get(`/analytics/sales${qs ? `?${qs}` : ''}`);
      return data.data as SalesAnalytics;
    },
  });
}
