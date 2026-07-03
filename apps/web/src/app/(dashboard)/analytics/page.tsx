'use client';

import { useStoreStore } from '@/stores/store.store';
import { AnalyticsDashboard } from '@/components/analytics/AnalyticsDashboard';
import Link from 'next/link';
import { BarChart3 } from 'lucide-react';

export default function MasterAnalyticsPage() {
  const { stores } = useStoreStore();
  const hasMultipleStores = stores.length > 1;

  if (!hasMultipleStores) {
    return (
      <div className="p-8 max-w-lg">
        <div className="rounded-xl border bg-white p-6 text-center">
          <BarChart3 className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <h1 className="text-lg font-semibold mb-1">Analytics</h1>
          <p className="text-sm text-muted-foreground mb-4">
            The all-stores analytics view is available when you have more than one store.
          </p>
          <Link href="/analytics/store" className="inline-flex text-sm px-4 py-2 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90">
            View store analytics
          </Link>
        </div>
      </div>
    );
  }

  return (
    <AnalyticsDashboard
      title="Analytics"
      description="Sales, customers, finance, and inventory across all stores."
      showLocationBreakdown
      allowStoreFilter
    />
  );
}
