'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { Archive, Search, RotateCcw } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import Link from 'next/link';
import api from '@/lib/api';
import { SourceBadge } from '@/components/shared/StatusBadge';
import { formatCurrency } from '@/lib/utils';
import type { Order } from '@/hooks/useOrders';

export default function ArchivesPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['orders-archived', page, search],
    queryFn: async () => {
      const params = new URLSearchParams({ status: 'ARCHIVED', page: String(page), limit: '25' });
      if (search) params.set('search', search);
      const { data } = await api.get(`/orders?${params.toString()}`);
      return data as { data: Order[]; pagination: { page: number; limit: number; total: number; totalPages: number } };
    },
  });

  const restoreMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.patch(`/orders/${id}`, { status: 'RECEIVED' });
      return data.data as Order;
    },
    onSuccess: () => {
      toast.success('Order restored to Orders');
      void qc.invalidateQueries({ queryKey: ['orders-archived'] });
      void qc.invalidateQueries({ queryKey: ['orders'] });
    },
    onError: () => toast.error('Failed to restore order'),
  });

  const totalPages = data?.pagination.totalPages ?? 1;

  return (
    <div className="p-8">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <Link href="/orders" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Orders
          </Link>
          <span className="text-muted-foreground">/</span>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Archive className="w-6 h-6 text-muted-foreground" /> Archives
          </h1>
        </div>
        <p className="text-sm text-muted-foreground">Archived orders are stored here and excluded from the main Orders view.</p>
      </div>

      {/* Search */}
      <div className="mb-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search archived orders..."
            className="w-full border border-input rounded-md pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      {/* Table */}
      <div className="border border-border rounded-md overflow-hidden bg-white">
        {isLoading ? (
          <div className="space-y-0">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-14 bg-muted animate-pulse border-b border-border last:border-0" />
            ))}
          </div>
        ) : data?.data.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Archive className="w-12 h-12 mb-4 opacity-30" />
            <p className="font-medium">No archived orders</p>
            <p className="text-sm mt-1">Orders you archive will appear here.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Source</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Customer</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Total</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Received</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence>
                {data?.data.map((order) => (
                  <motion.tr
                    key={order.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <SourceBadge source={order.source as never} />
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{order.customerFirstName} {order.customerLastName}</p>
                      <p className="text-xs text-muted-foreground">{order.customerEmail}</p>
                    </td>
                    <td className="px-4 py-3 font-medium">{formatCurrency(Number(order.total))}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(order.receivedAt), { addSuffix: true })}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => restoreMutation.mutate(order.id)}
                        disabled={restoreMutation.isPending}
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-border rounded-md hover:bg-accent transition-colors disabled:opacity-50"
                      >
                        <RotateCcw className="w-3 h-3" />
                        Restore
                      </button>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages} · {data?.pagination.total} archived
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 text-sm border border-border rounded-md disabled:opacity-50 hover:bg-accent"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1.5 text-sm border border-border rounded-md disabled:opacity-50 hover:bg-accent"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
