'use client';

import { useMemo, useState } from 'react';
import {
  DollarSign,
  ShoppingBag,
  TrendingUp,
  Package,
  Layers,
  Users,
  Wallet,
  Boxes,
  MapPin,
} from 'lucide-react';
import { useAnalytics } from '@/hooks/useAnalytics';
import { formatCurrency, cn } from '@/lib/utils';

type AnalyticsTab = 'sales' | 'customers' | 'finance' | 'inventory';

interface AnalyticsDashboardProps {
  title: string;
  description: string;
  storeId?: string;
  showLocationBreakdown?: boolean;
  allowStoreFilter?: boolean;
}

const TABS: { id: AnalyticsTab; label: string; icon: React.ElementType }[] = [
  { id: 'sales', label: 'Sales', icon: ShoppingBag },
  { id: 'customers', label: 'Customers', icon: Users },
  { id: 'finance', label: 'Finance', icon: Wallet },
  { id: 'inventory', label: 'Inventory', icon: Boxes },
];

function StatCard({ icon: Icon, label, value, accent }: { icon: React.ElementType; label: string; value: string; accent: string }) {
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

function DataTable({
  title,
  icon: Icon,
  headers,
  rows,
  emptyMessage,
}: {
  title: string;
  icon: React.ElementType;
  headers: string[];
  rows: (string | number)[][];
  emptyMessage: string;
}) {
  return (
    <div className="rounded-xl border bg-white overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-4 border-b">
        <Icon className="w-4 h-4 text-primary" />
        <h2 className="font-semibold text-sm">{title}</h2>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            {headers.map((h) => (
              <th key={h} className={cn('px-4 py-2 font-medium text-muted-foreground', h !== headers[0] && 'text-right')}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.length === 0 && (
            <tr><td colSpan={headers.length} className="text-center py-8 text-muted-foreground">{emptyMessage}</td></tr>
          )}
          {rows.map((row, i) => (
            <tr key={i} className="hover:bg-muted/30">
              {row.map((cell, j) => (
                <td key={j} className={cn('px-4 py-3', j === 0 ? 'font-medium' : 'text-right text-muted-foreground', j === row.length - 1 && row.length > 1 && 'font-medium text-foreground')}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatChannel(channel: string) {
  return channel.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatMonth(month: string) {
  const [y, m] = month.split('-');
  return new Date(Number(y), Number(m) - 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

export function AnalyticsDashboard({
  title,
  description,
  storeId,
  showLocationBreakdown = false,
  allowStoreFilter = false,
}: AnalyticsDashboardProps) {
  const [tab, setTab] = useState<AnalyticsTab>('sales');
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

  const { data, isLoading } = useAnalytics({
    storeId: storeId ?? (storeFilter || undefined),
    source: source || undefined,
    product: product || undefined,
    ...dateFilters,
  });

  const maxDayRevenue = Math.max(...(data?.sales.byDay.map((d) => d.revenue) ?? [1]), 1);

  return (
    <div className="p-8 max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="text-muted-foreground text-sm mt-1">{description}</p>
      </div>

      {/* Category tabs */}
      <div className="flex gap-1 border-b">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px',
              tab === t.id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <select value={range} onChange={(e) => setRange(e.target.value)} className="border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
          <option value="all">All time</option>
        </select>
        {allowStoreFilter && (
          <select value={storeFilter} onChange={(e) => setStoreFilter(e.target.value)} className="border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
            <option value="">All stores</option>
            {data?.filterOptions.stores.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        )}
        <select value={source} onChange={(e) => setSource(e.target.value)} className="border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
          <option value="">All channels</option>
          {data?.filterOptions.sources.map((s) => (
            <option key={s} value={s}>{formatChannel(s)}</option>
          ))}
        </select>
        <select value={product} onChange={(e) => setProduct(e.target.value)} className="border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-ring min-w-[180px]">
          <option value="">All products</option>
          {data?.filterOptions.products.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </div>

      {isLoading && <div className="text-center py-16 text-muted-foreground">Loading analytics...</div>}

      {data && tab === 'sales' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard icon={DollarSign} label="Revenue" value={formatCurrency(data.sales.summary.revenue)} accent="bg-emerald-500" />
            <StatCard icon={ShoppingBag} label="Orders" value={data.sales.summary.orders.toLocaleString()} accent="bg-blue-500" />
            <StatCard icon={TrendingUp} label="AOV" value={formatCurrency(data.sales.summary.avgOrderValue)} accent="bg-purple-500" />
          </div>

          {data.sales.byDay.length > 0 && (
            <div className="rounded-xl border bg-white p-6">
              <h2 className="font-semibold text-sm mb-4">Sales over time</h2>
              <div className="flex items-end gap-1 h-40">
                {data.sales.byDay.map((point) => (
                  <div key={point.date} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                    <div className="w-full bg-primary/80 rounded-t-sm hover:bg-primary transition-colors" style={{ height: `${Math.max((point.revenue / maxDayRevenue) * 100, 4)}%` }} title={`${point.date}: ${formatCurrency(point.revenue)}`} />
                    <span className="text-[10px] text-muted-foreground truncate w-full text-center">{point.date.slice(5)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className={cn('grid gap-6', showLocationBreakdown ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1')}>
            {showLocationBreakdown && (
              <DataTable
                title="Sales by location"
                icon={MapPin}
                headers={['Location', 'Orders', 'Revenue']}
                rows={data.sales.byLocation.map((r) => [r.storeName, r.orders, formatCurrency(r.revenue)])}
                emptyMessage="No sales by location yet"
              />
            )}
            <DataTable
              title="Sales by channel"
              icon={Layers}
              headers={['Channel', 'Orders', 'Revenue']}
              rows={data.sales.byChannel.map((r) => [formatChannel(r.channel), r.orders, formatCurrency(r.revenue)])}
              emptyMessage="No channel data yet"
            />
          </div>

          <DataTable
            title="Sales by product"
            icon={Package}
            headers={['Product', 'Qty', 'Orders', 'Revenue']}
            rows={data.sales.byProduct.map((r) => [r.product, r.quantity, r.orders, formatCurrency(r.revenue)])}
            emptyMessage="No product sales yet"
          />
        </div>
      )}

      {data && tab === 'customers' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={Users} label="Total customers" value={data.customers.summary.totalCustomers.toLocaleString()} accent="bg-blue-500" />
            <StatCard icon={Users} label="First-time" value={data.customers.summary.firstTimeCustomers.toLocaleString()} accent="bg-indigo-500" />
            <StatCard icon={Users} label="Returning" value={data.customers.summary.returningCustomers.toLocaleString()} accent="bg-violet-500" />
            <StatCard icon={TrendingUp} label="Repeat rate" value={`${data.customers.summary.repeatPurchaseRate.toFixed(1)}%`} accent="bg-purple-500" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <StatCard icon={DollarSign} label="Avg LTV" value={formatCurrency(data.customers.summary.avgLTV)} accent="bg-emerald-500" />
            <div className="rounded-xl border bg-white p-5">
              <p className="text-sm font-semibold mb-3">First-time vs returning</p>
              <div className="flex h-4 rounded-full overflow-hidden">
                <div className="bg-indigo-500" style={{ width: `${data.customers.summary.totalCustomers ? (data.customers.summary.firstTimeCustomers / data.customers.summary.totalCustomers) * 100 : 0}%` }} />
                <div className="bg-violet-500" style={{ width: `${data.customers.summary.totalCustomers ? (data.customers.summary.returningCustomers / data.customers.summary.totalCustomers) * 100 : 0}%` }} />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground mt-2">
                <span>First-time ({data.customers.summary.firstTimeCustomers})</span>
                <span>Returning ({data.customers.summary.returningCustomers})</span>
              </div>
            </div>
          </div>

          <DataTable
            title="Customer cohorts"
            icon={Users}
            headers={['Cohort', 'Customers', 'Orders', 'Revenue']}
            rows={data.customers.cohorts.map((c) => [formatMonth(c.cohort), c.customers, c.orders, formatCurrency(c.revenue)])}
            emptyMessage="No cohort data yet"
          />

          <DataTable
            title="Customer breakdown"
            icon={Users}
            headers={['Customer', 'Orders', 'LTV', 'Type']}
            rows={data.customers.breakdown.map((c) => [c.name, c.orders, formatCurrency(c.ltv), c.isReturning ? 'Returning' : 'First-time'])}
            emptyMessage="No customer data yet"
          />
        </div>
      )}

      {data && tab === 'finance' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={DollarSign} label="Gross sales" value={formatCurrency(data.finance.summary.grossSales)} accent="bg-emerald-500" />
            <StatCard icon={DollarSign} label="Returns" value={formatCurrency(data.finance.summary.returns)} accent="bg-red-500" />
            <StatCard icon={Wallet} label="Net sales" value={formatCurrency(data.finance.summary.netSales)} accent="bg-blue-500" />
            <StatCard icon={TrendingUp} label="Margin" value={`${data.finance.summary.margin.toFixed(1)}%`} accent="bg-purple-500" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard icon={Wallet} label="Taxes" value={formatCurrency(data.finance.summary.taxes)} accent="bg-amber-500" />
            <StatCard icon={Package} label="Shipping" value={formatCurrency(data.finance.summary.shipping)} accent="bg-orange-500" />
            <StatCard icon={DollarSign} label="Discounts" value={formatCurrency(data.finance.summary.discounts)} accent="bg-pink-500" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <DataTable
              title="Total sales by day"
              icon={DollarSign}
              headers={['Date', 'Orders', 'Sales']}
              rows={data.finance.byDay.map((r) => [r.date, r.orders, formatCurrency(r.revenue)])}
              emptyMessage="No daily sales yet"
            />
            <DataTable
              title="Total sales by month"
              icon={DollarSign}
              headers={['Month', 'Orders', 'Sales']}
              rows={data.finance.byMonth.map((r) => [formatMonth(r.month), r.orders, formatCurrency(r.revenue)])}
              emptyMessage="No monthly sales yet"
            />
          </div>

          <DataTable
            title="Sales by product (excl. shipping)"
            icon={Package}
            headers={['Product', 'Gross']}
            rows={data.finance.byProduct.map((r) => [r.product, formatCurrency(r.gross)])}
            emptyMessage="No product finance data yet"
          />

          <DataTable
            title="Sales by customer"
            icon={Users}
            headers={['Customer', 'Orders', 'Sales']}
            rows={data.finance.byCustomer.map((r) => [r.name, r.orders, formatCurrency(r.revenue)])}
            emptyMessage="No customer sales yet"
          />
        </div>
      )}

      {data && tab === 'inventory' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <StatCard icon={Boxes} label="Tracked products" value={data.inventory.summary.trackedProducts.toLocaleString()} accent="bg-blue-500" />
            <StatCard icon={Package} label="Units sold" value={data.inventory.summary.totalUnitsSold.toLocaleString()} accent="bg-emerald-500" />
          </div>
          <p className="text-sm text-muted-foreground">
            Inventory tracking is based on units sold from incoming orders. Connect a fulfillment platform for live stock levels.
          </p>
          <DataTable
            title="Product movement"
            icon={Boxes}
            headers={['Product', 'SKU', 'Units sold', 'Revenue']}
            rows={data.inventory.products.map((r) => [r.product, r.sku, r.unitsSold, formatCurrency(r.revenue)])}
            emptyMessage="No inventory movement yet"
          />
        </div>
      )}
    </div>
  );
}
