'use client';

import { useStoreStore } from '@/stores/store.store';
import { SalesDashboard } from '@/components/sales/SalesDashboard';
import Link from 'next/link';
import { BarChart3 } from 'lucide-react';

export default function MasterSalesPage() {
  const { stores } = useStoreStore();
  const hasMultipleStores = stores.length > 1;

  if (!hasMultipleStores) {
    return (
      <div className="p-8 max-w-lg">
        <div className="rounded-xl border bg-white p-6 text-center">
          <BarChart3 className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <h1 className="text-lg font-semibold mb-1">Master sales dashboard</h1>
          <p className="text-sm text-muted-foreground mb-4">
            The all-stores view is available when you have more than one store. View sales for your current store instead.
          </p>
          <Link
            href="/sales/store"
            className="inline-flex text-sm px-4 py-2 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90"
          >
            Go to store sales
          </Link>
        </div>
      </div>
    );
  }

  return (
    <SalesDashboard
      title="All Stores Sales"
      description="Combined revenue and performance across every store. Filter by store, category, or product."
      showStoreBreakdown
      allowStoreFilter
    />
  );
}
