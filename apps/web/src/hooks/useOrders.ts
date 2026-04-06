import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

interface OrderFilters {
  page?: number;
  limit?: number;
  status?: string;
  source?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
}

export function useOrders(filters: OrderFilters = {}) {
  return useQuery({
    queryKey: ['orders', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.page) params.set('page', String(filters.page));
      if (filters.limit) params.set('limit', String(filters.limit));
      if (filters.status) params.set('status', filters.status);
      if (filters.source) params.set('source', filters.source);
      if (filters.search) params.set('search', filters.search);
      if (filters.startDate) params.set('startDate', filters.startDate);
      if (filters.endDate) params.set('endDate', filters.endDate);

      const { data } = await api.get(`/orders?${params.toString()}`);
      return data as { data: Order[]; pagination: { page: number; limit: number; total: number; totalPages: number } };
    },
    refetchInterval: 30 * 1000,
  });
}

export function useOrder(id: string) {
  return useQuery({
    queryKey: ['order', id],
    queryFn: async () => {
      const { data } = await api.get(`/orders/${id}`);
      return data.data as Order;
    },
    enabled: !!id,
  });
}

export function useOrderStats() {
  return useQuery({
    queryKey: ['order-stats'],
    queryFn: async () => {
      const { data } = await api.get('/orders/stats');
      return data.data as OrderStats;
    },
    refetchInterval: 60 * 1000,
  });
}

export function usePatchOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: { id: string; notes?: string; tags?: string[]; status?: string }) => {
      const { data } = await api.patch(`/orders/${id}`, body);
      return data.data as Order;
    },
    onSuccess: (_, vars) => {
      void qc.invalidateQueries({ queryKey: ['order', vars.id] });
      void qc.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}

export function usePushOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, destination }: { id: string; destination: string }) => {
      const { data } = await api.post(`/orders/${id}/push`, { destination });
      return data.data;
    },
    onSuccess: (_, vars) => {
      void qc.invalidateQueries({ queryKey: ['order', vars.id] });
      void qc.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}

export function useArchiveOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.delete(`/orders/${id}`);
      return data.data as Order;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}

export function useRetryRoutingLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ orderId, routingLogId }: { orderId: string; routingLogId: string }) => {
      const { data } = await api.post(`/orders/${orderId}/retry`, { routingLogId });
      return data.data;
    },
    onSuccess: (_, vars) => {
      void qc.invalidateQueries({ queryKey: ['order', vars.orderId] });
      void qc.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}

export interface Order {
  id: string;
  source: string;
  status: string;
  customerEmail: string;
  customerFirstName: string;
  customerLastName: string;
  customerPhone?: string;
  lineItems: Array<{ name: string; quantity: number; unitPrice: number; total: number; sku?: string }>;
  subtotal: number;
  tax?: number;
  shipping?: number;
  total: number;
  currency: string;
  notes?: string;
  tags: string[];
  receivedAt: string;
  routingLogs?: RoutingLog[];
  shippingAddress?: Record<string, string>;
  billingAddress?: Record<string, string>;
  rawPayload?: unknown;
}

export interface RoutingLog {
  id: string;
  destination: string;
  status: string;
  externalOrderId?: string;
  errorMessage?: string;
  attemptCount: number;
  lastAttemptAt: string;
  succeededAt?: string;
  createdAt: string;
}

export interface OrderStats {
  total: number;
  byStatus: Array<{ status: string; count: number }>;
  bySource: Array<{ source: string; count: number }>;
  recentOrders: Array<{ receivedAt: string; total: number }>;
}
