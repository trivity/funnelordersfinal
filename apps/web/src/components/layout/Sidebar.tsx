'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  Home,
  ShoppingBag,
  Plug,
  GitBranch,
  CreditCard,
  User,
  LogOut,
  Settings,
  Archive,
  ChevronDown,
  Plus,
  Store,
  Check,
  Pencil,
  Trash2,
  X,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { useStoreStore } from '@/stores/store.store';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

const navItems = [
  { label: 'Home', href: '/', icon: Home },
  { label: 'Orders', href: '/orders', icon: ShoppingBag },
  { label: 'Archives', href: '/orders/archives', icon: Archive, sub: true },
  { label: 'Integrations', href: '/settings/integrations', icon: Plug },
  { label: 'Workflows', href: '/settings/routing-rules', icon: GitBranch },
  { label: 'Billing', href: '/settings/billing', icon: CreditCard },
  { label: 'Profile', href: '/settings/profile', icon: User },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const { stores, activeStoreId, setActiveStore, createStore, updateStore, deleteStore } = useStoreStore();
  const qc = useQueryClient();
  const router = useRouter();

  const [storeMenuOpen, setStoreMenuOpen] = useState(false);
  const [newStoreModal, setNewStoreModal] = useState(false);
  const [newStoreName, setNewStoreName] = useState('');
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const activeStore = stores.find((s) => s.id === activeStoreId) ?? stores[0];

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  const handleSwitchStore = (id: string) => {
    setActiveStore(id);
    setStoreMenuOpen(false);
    // Invalidate all store-scoped queries
    void qc.invalidateQueries({ queryKey: ['orders'] });
    void qc.invalidateQueries({ queryKey: ['integrations'] });
    void qc.invalidateQueries({ queryKey: ['routing-rules'] });
  };

  const handleCreateStore = async () => {
    if (!newStoreName.trim()) return;
    setCreating(true);
    try {
      const store = await createStore(newStoreName.trim());
      handleSwitchStore(store.id);
      setNewStoreModal(false);
      setNewStoreName('');
      toast.success(`"${store.name}" created`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? 'Failed to create store';
      toast.error(msg);
    } finally {
      setCreating(false);
    }
  };

  const handleRename = async (id: string) => {
    if (!editName.trim()) return;
    try {
      await updateStore(id, editName.trim());
      setEditingId(null);
      toast.success('Store renamed');
    } catch {
      toast.error('Failed to rename store');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    try {
      await deleteStore(id);
      void qc.invalidateQueries({ queryKey: ['orders'] });
      toast.success('Store deleted');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? 'Failed to delete store';
      toast.error(msg);
    }
  };

  return (
    <>
      <aside className="w-64 shrink-0 border-r border-border bg-white flex flex-col h-full">
        {/* Logo */}
        <div className="px-6 py-5 border-b border-border">
          <span className="text-xl font-bold text-primary">FunnelOrders</span>
        </div>

        {/* Store Switcher */}
        <div className="px-3 py-3 border-b border-border">
          <button
            onClick={() => setStoreMenuOpen((o) => !o)}
            className="w-full flex items-center justify-between px-3 py-2 rounded-md bg-muted/50 hover:bg-muted transition-colors text-sm"
          >
            <div className="flex items-center gap-2 min-w-0">
              <Store className="w-4 h-4 shrink-0 text-primary" />
              <span className="truncate font-medium">{activeStore?.name ?? 'My Store'}</span>
            </div>
            <ChevronDown className={cn('w-4 h-4 text-muted-foreground shrink-0 transition-transform', storeMenuOpen && 'rotate-180')} />
          </button>

          <AnimatePresence>
            {storeMenuOpen && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
                className="mt-1 bg-white border border-border rounded-md shadow-lg overflow-hidden z-50"
              >
                <div className="max-h-48 overflow-y-auto">
                  {stores.map((store) => (
                    <div key={store.id} className="group flex items-center gap-1 px-2 py-1.5 hover:bg-muted/50">
                      {editingId === store.id ? (
                        <div className="flex items-center gap-1 flex-1">
                          <input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') void handleRename(store.id); if (e.key === 'Escape') setEditingId(null); }}
                            className="flex-1 text-xs border border-input rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-ring"
                            autoFocus
                          />
                          <button onClick={() => void handleRename(store.id)} className="text-primary"><Check className="w-3.5 h-3.5" /></button>
                          <button onClick={() => setEditingId(null)} className="text-muted-foreground"><X className="w-3.5 h-3.5" /></button>
                        </div>
                      ) : (
                        <>
                          <button
                            onClick={() => handleSwitchStore(store.id)}
                            className="flex-1 flex items-center gap-2 text-sm text-left"
                          >
                            {activeStoreId === store.id
                              ? <Check className="w-3.5 h-3.5 text-primary shrink-0" />
                              : <span className="w-3.5 h-3.5 shrink-0" />
                            }
                            <span className="truncate">{store.name}</span>
                          </button>
                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => { setEditingId(store.id); setEditName(store.name); }}
                              className="p-1 text-muted-foreground hover:text-foreground rounded"
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                            {stores.length > 1 && (
                              <button
                                onClick={() => void handleDelete(store.id, store.name)}
                                className="p-1 text-muted-foreground hover:text-destructive rounded"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
                <div className="border-t border-border">
                  <button
                    onClick={() => { setStoreMenuOpen(false); setNewStoreModal(true); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-primary hover:bg-primary/5 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    New Store
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = item.sub || item.href === '/'
              ? pathname === item.href
              : pathname === item.href || (pathname.startsWith(item.href + '/') && item.href !== '/orders');
            return (
              <Link key={item.href} href={item.href} className={item.sub ? 'pl-4 block' : 'block'}>
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer',
                    item.sub && 'text-xs',
                    isActive
                      ? 'bg-primary/10 text-primary border-l-2 border-primary'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent',
                  )}
                >
                  <item.icon className="w-4 h-4 shrink-0" />
                  {item.label}
                </motion.div>
              </Link>
            );
          })}

          {user?.role === 'ADMIN' && (
            <Link href="/admin">
              <motion.div
                whileHover={{ scale: 1.02 }}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer',
                  pathname.startsWith('/admin')
                    ? 'bg-primary/10 text-primary border-l-2 border-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent',
                )}
              >
                <Settings className="w-4 h-4 shrink-0" />
                Admin
              </motion.div>
            </Link>
          )}
        </nav>

        {/* User footer */}
        <div className="px-4 py-4 border-t border-border">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{user?.firstName} {user?.lastName}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            </div>
            <button onClick={handleLogout} className="p-2 text-muted-foreground hover:text-foreground rounded-md hover:bg-accent">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* New Store Modal */}
      <AnimatePresence>
        {newStoreModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center"
          >
            <div className="absolute inset-0 bg-black/40" onClick={() => setNewStoreModal(false)} />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm mx-4"
            >
              <h2 className="text-lg font-semibold mb-1">Create New Store</h2>
              <p className="text-sm text-muted-foreground mb-4">Each store has its own integrations, orders, and workflows.</p>
              <input
                value={newStoreName}
                onChange={(e) => setNewStoreName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void handleCreateStore(); }}
                placeholder="e.g. My WooCommerce Store"
                className="w-full border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring mb-4"
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  onClick={() => void handleCreateStore()}
                  disabled={creating || !newStoreName.trim()}
                  className="flex-1 bg-primary text-primary-foreground rounded-md py-2 text-sm font-medium disabled:opacity-50"
                >
                  {creating ? 'Creating...' : 'Create Store'}
                </button>
                <button
                  onClick={() => { setNewStoreModal(false); setNewStoreName(''); }}
                  className="px-4 py-2 border border-border rounded-md text-sm hover:bg-accent"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
