'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from '@tanstack/react-table';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { Search, SlidersHorizontal, Package, RefreshCw } from 'lucide-react';
import { useOrders, type Order } from '@/hooks/useOrders';
import { StatusBadge, SourceBadge } from '@/components/shared/StatusBadge';
import { OrderDetailSheet } from '@/components/orders/OrderDetailSheet';
import { formatCurrency, truncate } from '@/lib/utils';
import { fireConfetti } from '@/lib/confetti';

export default function OrdersPage() {
  const router = useRouter();
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [prevTotal, setPrevTotal] = useState(0);
  const [hasSeenFirstOrder, setHasSeenFirstOrder] = useState(false);

  const { data, isLoading, refetch, isFetching } = useOrders({
    page,
    limit: 25,
    search: search || undefined,
    status: statusFilter || undefined,
    source: sourceFilter || undefined,
  });

  // Confetti on first order received
  useEffect(() => {
    if (data && data.data.length === 1 && !hasSeenFirstOrder && prevTotal === 0) {
      fireConfetti.fullScreen();
      setHasSeenFirstOrder(true);
    }
    if (data) setPrevTotal(data.pagination.total);
  }, [data, hasSeenFirstOrder, prevTotal]);

  const columns: ColumnDef<Order>[] = [
    {
      accessorKey: 'source',
      header: 'Source',
      cell: ({ row }) => <SourceBadge source={row.original.source as never} />,
    },
    {
      accessorKey: 'id',
      header: 'Order ID',
      cell: ({ getValue }) => (
        <span className="font-mono text-xs text-muted-foreground">{truncate(getValue<string>(), 12)}</span>
      ),
    },
    {
      id: 'customer',
      header: 'Customer',
      cell: ({ row }) => (
        <div>
          <p className="font-medium text-sm">{row.original.customerFirstName} {row.original.customerLastName}</p>
          <p className="text-xs text-muted-foreground">{row.original.customerEmail}</p>
        </div>
      ),
    },
    {
      id: 'items',
      header: 'Items',
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">{row.original.lineItems.length} item{row.original.lineItems.length !== 1 ? 's' : ''}</span>
      ),
    },
    {
      accessorKey: 'total',
      header: 'Total',
      cell: ({ getValue }) => <span className="font-medium text-sm">{formatCurrency(Number(getValue<number>()))}</span>,
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ getValue }) => <StatusBadge status={getValue<never>()} />,
    },
    {
      accessorKey: 'receivedAt',
      header: 'Received',
      cell: ({ getValue }) => (
        <span className="text-xs text-muted-foreground" title={getValue<string>()}>
          {formatDistanceToNow(new Date(getValue<string>()), { addSuffix: true })}
        </span>
      ),
    },
  ];

  const table = useReactTable({
    data: data?.data ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount: data?.pagination.totalPages ?? 0,
  });

  const totalPages = data?.pagination.totalPages ?? 1;

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">Orders</h1>
            <button
              onClick={() => void refetch()}
              disabled={isFetching}
              title="Refresh orders"
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-40"
            >
              <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
            </button>
          </div>
          {data && (
            <p className="text-muted-foreground text-sm mt-1">{data.pagination.total.toLocaleString()} total orders</p>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search orders..."
            className="w-full border border-input rounded-md pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">All statuses</option>
          {['RECEIVED', 'PROCESSING', 'ROUTED', 'PARTIALLY_ROUTED', 'FAILED', 'ARCHIVED'].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        <select
          value={sourceFilter}
          onChange={(e) => { setSourceFilter(e.target.value); setPage(1); }}
          className="border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">All sources</option>
          {['CLICKFUNNELS', 'GHL', 'KARTRA', 'MANUAL'].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="border border-border rounded-md overflow-hidden bg-white">
        {isLoading ? (
          <div className="space-y-0">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-14 bg-muted animate-pulse border-b border-border last:border-0" />
            ))}
          </div>
        ) : data?.data.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Package className="w-12 h-12 mb-4 opacity-30" />
            <p className="font-medium">No orders yet</p>
            <p className="text-sm mt-1">Set up an integration to start receiving orders.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id}>
                  {hg.headers.map((header) => (
                    <th key={header.id} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              <AnimatePresence>
                {table.getRowModel().rows.map((row) => (
                  <motion.tr
                    key={row.id}
                    initial={{ backgroundColor: 'rgba(37, 99, 235, 0.1)' }}
                    animate={{ backgroundColor: 'rgba(255, 255, 255, 0)' }}
                    transition={{ duration: 1.5 }}
                    onClick={() => setSelectedOrder(row.original)}
                    className="border-b border-border last:border-0 cursor-pointer hover:bg-muted/30 transition-colors"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-4 py-3">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
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
            Page {page} of {totalPages}
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

      {/* Order detail sheet */}
      {selectedOrder && (
        <OrderDetailSheet order={selectedOrder} onClose={() => setSelectedOrder(null)} />
      )}
    </div>
  );
}
