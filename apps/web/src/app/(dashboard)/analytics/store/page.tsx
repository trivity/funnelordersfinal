'use client';

import { useStoreStore } from '@/stores/store.store';
import { AnalyticsDashboard } from '@/components/analytics/AnalyticsDashboard';

export default function StoreAnalyticsPage() {
  const { stores, activeStoreId } = useStoreStore();
  const activeStore = stores.find((s) => s.id === activeStoreId) ?? stores[0];

  if (!activeStore) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        No store selected. Create or select a store to view analytics.
      </div>
    );
  }

  return (
    <AnalyticsDashboard
      title={`${activeStore.name} Analytics`}
      description="Sales, customers, finance, and inventory for this store."
      storeId={activeStore.id}
    />
  );
}
