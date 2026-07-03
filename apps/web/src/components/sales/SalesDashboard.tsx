'use client';

import { useMemo, useState } from 'react';
import { DollarSign, ShoppingBag, TrendingUp, Store, Package, Layers } from 'lucide-react';
import { useSalesAnalytics } from '@/hooks/useSalesAnalytics';
import { formatCurrency, cn } from '@/lib/utils';

interface SalesDashboardProps {
  title: string;
  description: string;
  storeId?: string;
  showStoreBreakdown?: boolean;
  allowStoreFilter?: boolean;
}

function StatCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div className="rounded-xl border bg-white p-5 flex items-center gap-4">
      <div className={cn('p-3 rounded-full', accent)}>
        <Icon className="h-5 w-5 text-white" />
      </div>
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold">{value}</p>
      </div>
    </div>
  );
}

function formatSourceLabel(source: string) {
  return source.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

export function SalesDashboard({ title, description, storeId, showStoreBreakdown = false, allowStoreFilter = false }: SalesDashboardProps) {
  const [source, setSource] = useState('');
  const [product, setProduct] = useState('');
  const [storeFilter, setStoreFilter] = useState('');
  const [range, setRange] = useState('30');

  const dateFilters = useMemo(() => {
    if (range === 'all') return {};
    const days = Number(range);
    const start = new Date();
    start.setDate(start.getDate() - days);
    return { startDate: start.toISOString() };
  }, [range]);

  const { data, isLoading } = useSalesAnalytics({
    storeId: storeId ?? (storeFilter || undefined),
    source: source || undefined,
    product: product || undefined,
    ...dateFilters,
  });

  const maxRevenue = Math.max(...(data?.timeSeries.map((d) => d.revenue) ?? [1]), 1);

  return (
    <div className="p-8 max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="text-muted-foreground text-sm mt-1">{description}</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={range}
          onChange={(e) => setRange(e.target.value)}
          className="border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
          <option value="all">All time</option>
        </select>

        {allowStoreFilter && (
          <select
            value={storeFilter}
            onChange={(e) => setStoreFilter(e.target.value)}
            className="border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">All stores</option>
            {data?.filterOptions.stores.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        )}

        <select
          value={source}
          onChange={(e) => setSource(e.target.value)}
          className="border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">All categories</option>
          {data?.filterOptions.sources.map((s) => (
            <option key={s} value={s}>{formatSourceLabel(s)}</option>
          ))}
        </select>

        <select
          value={product}
          onChange={(e) => setProduct(e.target.value)}
          className="border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring min-w-[180px]"
        >
          <option value="">All products</option>
          {data?.filterOptions.products.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </div>

      {isLoading && (
        <div className="text-center py-16 text-muted-foreground">Loading sales data...</div>
      )}

      {data && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard
              icon={DollarSign}
              label="Total revenue"
              value={formatCurrency(data.summary.totalRevenue)}
              accent="bg-emerald-500"
            />
            <StatCard
              icon={ShoppingBag}
              label="Total orders"
              value={data.summary.totalOrders.toLocaleString()}
              accent="bg-blue-500"
            />
            <StatCard
              icon={TrendingUp}
              label="Avg order value"
              value={formatCurrency(data.summary.avgOrderValue)}
              accent="bg-purple-500"
            />
          </div>

          {/* Revenue chart */}
          {data.timeSeries.length > 0 && (
            <div className="rounded-xl border bg-white p-6">
              <h2 className="font-semibold text-sm mb-4">Revenue over time</h2>
              <div className="flex items-end gap-1 h-40">
                {data.timeSeries.map((point) => (
                  <div key={point.date} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                    <div
                      className="w-full bg-primary/80 rounded-t-sm transition-all hover:bg-primary"
                      style={{ height: `${Math.max((point.revenue / maxRevenue) * 100, 4)}%` }}
                      title={`${point.date}: ${formatCurrency(point.revenue)}`}
                    />
                    <span className="text-[10px] text-muted-foreground truncate w-full text-center">
                      {point.date.slice(5)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className={cn('grid gap-6', showStoreBreakdown ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1')}>
            {/* By store (master only) */}
            {showStoreBreakdown && (
              <div className="rounded-xl border bg-white overflow-hidden">
                <div className="flex items-center gap-2 px-5 py-4 border-b">
                  <Store className="w-4 h-4 text-primary" />
                  <h2 className="font-semibold text-sm">Sales by store</h2>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left px-4 py-2 font-medium text-muted-foreground">Store</th>
                      <th className="text-right px-4 py-2 font-medium text-muted-foreground">Orders</th>
                      <th className="text-right px-4 py-2 font-medium text-muted-foreground">Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {data.byStore.length === 0 && (
                      <tr><td colSpan={3} className="text-center py-8 text-muted-foreground">No sales yet</td></tr>
                    )}
                    {data.byStore.map((row) => (
                      <tr key={row.storeId} className="hover:bg-muted/30">
                        <td className="px-4 py-3 font-medium">{row.storeName}</td>
                        <td className="px-4 py-3 text-right text-muted-foreground">{row.orders}</td>
                        <td className="px-4 py-3 text-right font-medium">{formatCurrency(row.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* By category/source */}
            <div className="rounded-xl border bg-white overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-4 border-b">
                <Layers className="w-4 h-4 text-primary" />
                <h2 className="font-semibold text-sm">Sales by category</h2>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Category</th>
                    <th className="text-right px-4 py-2 font-medium text-muted-foreground">Orders</th>
                    <th className="text-right px-4 py-2 font-medium text-muted-foreground">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.bySource.length === 0 && (
                    <tr><td colSpan={3} className="text-center py-8 text-muted-foreground">No sales yet</td></tr>
                  )}
                  {data.bySource.map((row) => (
                    <tr key={row.source} className="hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium">{formatSourceLabel(row.source)}</td>
                      <td className="px-4 py-3 text-right text-muted-foreground">{row.orders}</td>
                      <td className="px-4 py-3 text-right font-medium">{formatCurrency(row.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* By product */}
          <div className="rounded-xl border bg-white overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-4 border-b">
              <Package className="w-4 h-4 text-primary" />
              <h2 className="font-semibold text-sm">Top products</h2>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Product</th>
                  <th className="text-right px-4 py-2 font-medium text-muted-foreground">Qty</th>
                  <th className="text-right px-4 py-2 font-medium text-muted-foreground">Orders</th>
                  <th className="text-right px-4 py-2 font-medium text-muted-foreground">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.byProduct.length === 0 && (
                  <tr><td colSpan={4} className="text-center py-8 text-muted-foreground">No product data yet</td></tr>
                )}
                {data.byProduct.map((row) => (
                  <tr key={row.product} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">{row.product}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{row.quantity}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{row.orders}</td>
                    <td className="px-4 py-3 text-right font-medium">{formatCurrency(row.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
