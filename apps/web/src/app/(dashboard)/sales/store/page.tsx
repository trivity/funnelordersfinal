'use client';

import { useStoreStore } from '@/stores/store.store';
import { SalesDashboard } from '@/components/sales/SalesDashboard';

export default function StoreSalesPage() {
  const { stores, activeStoreId } = useStoreStore();
  const activeStore = stores.find((s) => s.id === activeStoreId) ?? stores[0];

  if (!activeStore) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        No store selected. Create or select a store to view sales.
      </div>
    );
  }

  return (
    <SalesDashboard
      title={`${activeStore.name} Sales`}
      description="Revenue and performance for this store. Filter by category or product."
      storeId={activeStore.id}
    />
  );
}
