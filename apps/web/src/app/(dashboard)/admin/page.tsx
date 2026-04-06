'use client';

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, ShoppingBag, Activity, Shield, Trash2, UserX, UserCheck, Key, RefreshCw, DollarSign, Mail } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

interface AdminStats {
  totalUsers: number;
  totalOrders: number;
  activeSubscriptions: number;
}

interface AdminUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  status: string;
  planTier: string;
  createdAt: string;
}

function StatCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: number | string; color: string }) {
  return (
    <div className="rounded-lg border bg-card p-6 flex items-center gap-4">
      <div className={`p-3 rounded-full ${color}`}>
        <Icon className="h-5 w-5 text-white" />
      </div>
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold">{value}</p>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'users' | 'logs' | 'stripe'>('users');

  useEffect(() => {
    if (user && user.role !== 'ADMIN') router.replace('/orders');
  }, [user, router]);

  const { data: stats } = useQuery<AdminStats>({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      const res = await api.get('/admin/stats');
      return res.data.data;
    },
  });

  const { data: users, isLoading: usersLoading } = useQuery<AdminUser[]>({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const res = await api.get('/admin/users?limit=50');
      return res.data.data;
    },
    enabled: tab === 'users',
  });

  const { data: logs } = useQuery<{ id: string; action: string; entityType: string; createdAt: string; user?: { email: string } }[]>({
    queryKey: ['admin-logs'],
    queryFn: async () => {
      const res = await api.get('/admin/audit-logs?limit=50');
      return res.data.data;
    },
    enabled: tab === 'logs',
  });

  const suspendMutation = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: 'suspend' | 'unsuspend' }) => {
      await api.post(`/admin/users/${id}/${action}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success('User status updated');
    },
    onError: () => toast.error('Failed to update user'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/admin/users/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success('User deleted');
    },
    onError: () => toast.error('Failed to delete user'),
  });

  if (user?.role !== 'ADMIN') return null;

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3">
        <Shield className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Admin Panel</h1>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon={Users} label="Total Users" value={stats?.totalUsers ?? '—'} color="bg-blue-500" />
        <StatCard icon={ShoppingBag} label="Total Orders" value={stats?.totalOrders ?? '—'} color="bg-green-500" />
        <StatCard icon={Activity} label="Active Subscriptions" value={stats?.activeSubscriptions ?? '—'} color="bg-purple-500" />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        {(['users', 'logs', 'stripe'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize border-b-2 transition-colors ${
              tab === t ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t === 'users' ? 'Users' : t === 'logs' ? 'Audit Logs' : 'Stripe Config'}
          </button>
        ))}
      </div>

      {/* Users Table */}
      {tab === 'users' && (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">User</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Role</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Plan</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Joined</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {usersLoading && (
                <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">Loading...</td></tr>
              )}
              {users?.map((u) => (
                <tr key={u.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium">{u.firstName} {u.lastName}</p>
                    <p className="text-xs text-muted-foreground">{u.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      u.role === 'ADMIN' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'
                    }`}>{u.role}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-medium">{u.planTier}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      u.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>{u.status}</span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {formatDistanceToNow(new Date(u.createdAt), { addSuffix: true })}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {u.role !== 'ADMIN' && (
                        <>
                          <button
                            onClick={() => suspendMutation.mutate({ id: u.id, action: u.status === 'ACTIVE' ? 'suspend' : 'unsuspend' })}
                            className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                            title={u.status === 'ACTIVE' ? 'Suspend' : 'Unsuspend'}
                          >
                            {u.status === 'ACTIVE' ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                          </button>
                          <button
                            onClick={() => { if (confirm(`Delete ${u.email}?`)) deleteMutation.mutate(u.id); }}
                            className="p-1.5 rounded hover:bg-red-50 transition-colors text-muted-foreground hover:text-red-600"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Stripe Config */}
      {tab === 'stripe' && <StripeConfigPanel />}

      {/* Audit Logs */}
      {tab === 'logs' && (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Action</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Entity</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">User</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">When</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {logs?.map((log) => (
                <tr key={log.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs">{log.action}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{log.entityType}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{log.user?.email ?? '—'}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ─── Stripe Config Panel ─────────────────────────────────────────────────── */

interface ConfigData {
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  STRIPE_PRICE_STARTER?: string;
  STRIPE_PRICE_GROWTH?: string;
  STRIPE_PRICE_AGENCY?: string;
  RESEND_API_KEY?: string;
}

function EmailConfigPanel({ config, saveMutation }: { config: ConfigData | undefined; saveMutation: ReturnType<typeof useMutation<void, Error, Record<string, string>>> }) {
  const [resendKey, setResendKey] = useState('');

  const handleSave = () => {
    if (!resendKey) { toast.info('No changes to save'); return; }
    saveMutation.mutate({ RESEND_API_KEY: resendKey });
    setResendKey('');
  };

  return (
    <div className="border border-border rounded-lg p-6 bg-white">
      <div className="flex items-center gap-2 mb-4">
        <Mail className="w-5 h-5 text-primary" />
        <h2 className="font-semibold">Email Config (Resend)</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Override the Resend API key used for sending password reset emails. Takes effect immediately.
      </p>
      <div>
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide block mb-1">
          Resend API Key
        </label>
        {config?.RESEND_API_KEY && (
          <p className="text-xs text-muted-foreground mb-1 font-mono">Current: {config.RESEND_API_KEY.slice(0, 8)}••••••••</p>
        )}
        <input
          type="password"
          value={resendKey}
          onChange={(e) => setResendKey(e.target.value)}
          placeholder="re_..."
          className="w-full border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring font-mono"
        />
      </div>
      <button
        onClick={handleSave}
        disabled={saveMutation.isPending}
        className="mt-4 flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium disabled:opacity-50"
      >
        <Key className="w-4 h-4" />
        {saveMutation.isPending ? 'Saving...' : 'Save Key'}
      </button>
    </div>
  );
}

function StripeConfigPanel() {
  const qc = useQueryClient();
  const [fields, setFields] = useState<ConfigData>({});
  const [prices, setPrices] = useState({ STARTER: '29.99', GROWTH: '49.99', AGENCY: '97.99' });
  const [syncing, setSyncing] = useState(false);

  const { data: config } = useQuery<ConfigData>({
    queryKey: ['admin-config'],
    queryFn: async () => {
      const { data } = await api.get('/admin/config');
      return data.data as ConfigData;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (updates: Record<string, string>) => {
      await api.patch('/admin/config', { updates });
    },
    onSuccess: () => {
      toast.success('Configuration saved');
      void qc.invalidateQueries({ queryKey: ['admin-config'] });
    },
    onError: () => toast.error('Failed to save configuration'),
  });

  const handleSaveKeys = () => {
    const updates: Record<string, string> = {};
    if (fields.STRIPE_SECRET_KEY) updates['STRIPE_SECRET_KEY'] = fields.STRIPE_SECRET_KEY;
    if (fields.STRIPE_WEBHOOK_SECRET) updates['STRIPE_WEBHOOK_SECRET'] = fields.STRIPE_WEBHOOK_SECRET;
    if (Object.keys(updates).length === 0) { toast.info('No changes to save'); return; }
    saveMutation.mutate(updates);
  };

  const handleSyncPrices = async () => {
    setSyncing(true);
    try {
      await api.post('/admin/stripe/sync-prices', {
        prices: [
          { tier: 'STARTER', amount: parseFloat(prices.STARTER) },
          { tier: 'GROWTH', amount: parseFloat(prices.GROWTH) },
          { tier: 'AGENCY', amount: parseFloat(prices.AGENCY) },
        ],
      });
      toast.success('Stripe prices synced and updated');
      void qc.invalidateQueries({ queryKey: ['billing-plans'] });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? 'Failed to sync prices';
      toast.error(msg);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Stripe API Keys */}
      <div className="border border-border rounded-lg p-6 bg-white">
        <div className="flex items-center gap-2 mb-4">
          <Key className="w-5 h-5 text-primary" />
          <h2 className="font-semibold">Stripe API Keys</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Override the Stripe keys from the environment. Changes take effect immediately without a server restart.
        </p>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide block mb-1">
              Secret Key (sk_live_... or sk_test_...)
            </label>
            {config?.STRIPE_SECRET_KEY && (
              <p className="text-xs text-muted-foreground mb-1 font-mono">Current: {config.STRIPE_SECRET_KEY}</p>
            )}
            <input
              type="password"
              value={fields.STRIPE_SECRET_KEY ?? ''}
              onChange={(e) => setFields((f) => ({ ...f, STRIPE_SECRET_KEY: e.target.value }))}
              placeholder="sk_live_..."
              className="w-full border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring font-mono"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide block mb-1">
              Webhook Secret (whsec_...)
            </label>
            {config?.STRIPE_WEBHOOK_SECRET && (
              <p className="text-xs text-muted-foreground mb-1 font-mono">Current: {config.STRIPE_WEBHOOK_SECRET}</p>
            )}
            <input
              type="password"
              value={fields.STRIPE_WEBHOOK_SECRET ?? ''}
              onChange={(e) => setFields((f) => ({ ...f, STRIPE_WEBHOOK_SECRET: e.target.value }))}
              placeholder="whsec_..."
              className="w-full border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring font-mono"
            />
          </div>
        </div>
        <button
          onClick={handleSaveKeys}
          disabled={saveMutation.isPending}
          className="mt-4 flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium disabled:opacity-50"
        >
          <Key className="w-4 h-4" />
          {saveMutation.isPending ? 'Saving...' : 'Save Keys'}
        </button>
      </div>

      {/* Email Config */}
      <EmailConfigPanel config={config} saveMutation={saveMutation} />

      {/* Package Pricing */}
      <div className="border border-border rounded-lg p-6 bg-white">
        <div className="flex items-center gap-2 mb-4">
          <DollarSign className="w-5 h-5 text-primary" />
          <h2 className="font-semibold">Package Pricing</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Update prices here. Click "Sync to Stripe" to create new Stripe prices, archive the old ones, and update the billing page automatically.
        </p>
        <div className="grid grid-cols-3 gap-4 mb-4">
          {(['STARTER', 'GROWTH', 'AGENCY'] as const).map((tier) => (
            <div key={tier}>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide block mb-1">{tier}</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={prices[tier]}
                  onChange={(e) => setPrices((p) => ({ ...p, [tier]: e.target.value }))}
                  className="w-full border border-input rounded-md pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {tier === 'STARTER' ? '1 store' : tier === 'GROWTH' ? '5 stores' : 'Unlimited'}
              </p>
            </div>
          ))}
        </div>
        <button
          onClick={() => void handleSyncPrices()}
          disabled={syncing}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Syncing...' : 'Sync to Stripe'}
        </button>
        <p className="text-xs text-muted-foreground mt-2">
          ⚠️ Existing subscribers keep their current price until they next renew.
        </p>
      </div>

      {/* Stored Price IDs */}
      {config && (config.STRIPE_PRICE_STARTER || config.STRIPE_PRICE_GROWTH || config.STRIPE_PRICE_AGENCY) && (
        <div className="border border-border rounded-lg p-6 bg-white">
          <h3 className="font-medium text-sm mb-3">Active Stripe Price IDs</h3>
          <div className="space-y-1 font-mono text-xs text-muted-foreground">
            {config.STRIPE_PRICE_STARTER && <p>STARTER: {config.STRIPE_PRICE_STARTER}</p>}
            {config.STRIPE_PRICE_GROWTH && <p>GROWTH: {config.STRIPE_PRICE_GROWTH}</p>}
            {config.STRIPE_PRICE_AGENCY && <p>AGENCY: {config.STRIPE_PRICE_AGENCY}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
