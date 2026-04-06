import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api, { setStoreId } from '@/lib/api';

export interface Store {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

interface StoreState {
  stores: Store[];
  activeStoreId: string | null;
  isLoading: boolean;
  fetchStores: () => Promise<void>;
  setActiveStore: (storeId: string) => void;
  createStore: (name: string) => Promise<Store>;
  updateStore: (id: string, name: string) => Promise<void>;
  deleteStore: (id: string) => Promise<void>;
}

export const useStoreStore = create<StoreState>()(
  persist(
    (set, get) => ({
      stores: [],
      activeStoreId: null,
      isLoading: false,

      fetchStores: async () => {
        set({ isLoading: true });
        try {
          const { data } = await api.get('/stores');
          const stores = data.data as Store[];
          set({ stores });

          // If no active store or active store no longer exists, pick the first
          const { activeStoreId } = get();
          const valid = stores.find((s) => s.id === activeStoreId);
          if (!valid && stores.length > 0) {
            const firstId = stores[0]!.id;
            set({ activeStoreId: firstId });
            setStoreId(firstId);
          } else if (valid) {
            setStoreId(valid.id);
          }
        } finally {
          set({ isLoading: false });
        }
      },

      setActiveStore: (storeId: string) => {
        set({ activeStoreId: storeId });
        setStoreId(storeId);
      },

      createStore: async (name: string) => {
        const { data } = await api.post('/stores', { name });
        const store = data.data as Store;
        set((state) => ({ stores: [...state.stores, store] }));
        return store;
      },

      updateStore: async (id: string, name: string) => {
        await api.patch(`/stores/${id}`, { name });
        set((state) => ({
          stores: state.stores.map((s) => (s.id === id ? { ...s, name } : s)),
        }));
      },

      deleteStore: async (id: string) => {
        await api.delete(`/stores/${id}`);
        const { stores, activeStoreId } = get();
        const remaining = stores.filter((s) => s.id !== id);
        set({ stores: remaining });
        if (activeStoreId === id && remaining.length > 0) {
          const newId = remaining[0]!.id;
          set({ activeStoreId: newId });
          setStoreId(newId);
        }
      },
    }),
    {
      name: 'fo-active-store',
      partialize: (state) => ({ activeStoreId: state.activeStoreId }),
    },
  ),
);
