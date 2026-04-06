'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2,
  Circle,
  Plug,
  GitBranch,
  ShoppingBag,
  Rocket,
  X,
  AlertTriangle,
  RefreshCw,
  ArrowRight,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import api from '@/lib/api';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { useOrders, useRetryRoutingLog } from '@/hooks/useOrders';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChecklistStatus {
  hasIntegration: boolean;
  hasRoutingRule: boolean;
  hasOrder: boolean;
  hasRoutedOrder: boolean;
}

interface FailedOrder {
  id: string;
  customerFirstName: string;
  customerLastName: string;
  total: number;
  receivedAt: string;
  routingLogs: Array<{ id: string; destination: string; errorMessage: string | null; status: string }>;
}

// ─── Checklist Step ───────────────────────────────────────────────────────────

function Step({
  done,
  label,
  description,
  href,
  cta,
}: {
  done: boolean;
  label: string;
  description: string;
  href: string;
  cta: string;
}) {
  const router = useRouter();
  return (
    <div className={`flex items-start gap-4 p-4 rounded-lg border transition-colors ${done ? 'bg-green-50 border-green-200' : 'bg-white border-border hover:border-primary/40'}`}>
      <div className="mt-0.5 shrink-0">
        {done ? (
          <CheckCircle2 className="w-5 h-5 text-green-600" />
        ) : (
          <Circle className="w-5 h-5 text-muted-foreground" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold ${done ? 'text-green-700 line-through decoration-green-400' : 'text-foreground'}`}>{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
      {!done && (
        <button
          onClick={() => router.push(href)}
          className="shrink-0 text-xs px-3 py-1.5 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 flex items-center gap-1"
        >
          {cta} <ArrowRight className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user, fetchMe } = useAuthStore();
  const router = useRouter();
  const [checklist, setChecklist] = useState<ChecklistStatus | null>(null);
  const [dismissing, setDismissing] = useState(false);

  const { data: failedOrdersData } = useOrders({ page: 1, limit: 5, status: 'FAILED' });
  const retryLog = useRetryRoutingLog();

  // Fetch checklist status
  useEffect(() => {
    async function load() {
      try {
        const [intRes, ruleRes, orderRes, routedRes] = await Promise.allSettled([
          api.get('/integrations?limit=1'),
          api.get('/routing-rules?limit=1'),
          api.get('/orders?limit=1'),
          api.get('/orders?limit=1&status=ROUTED'),
        ]);

        setChecklist({
          hasIntegration:
            intRes.status === 'fulfilled' && (intRes.value.data.data?.length ?? 0) > 0,
          hasRoutingRule:
            ruleRes.status === 'fulfilled' && (ruleRes.value.data.data?.length ?? 0) > 0,
          hasOrder:
            orderRes.status === 'fulfilled' &&
            (orderRes.value.data.pagination?.total ?? 0) > 0,
          hasRoutedOrder:
            routedRes.status === 'fulfilled' &&
            (routedRes.value.data.pagination?.total ?? 0) > 0,
        });
      } catch {
        // silently fail
      }
    }
    void load();
  }, []);

  const allDone =
    checklist !== null &&
    checklist.hasIntegration &&
    checklist.hasRoutingRule &&
    checklist.hasOrder &&
    checklist.hasRoutedOrder;

  const completedCount = checklist
    ? [checklist.hasIntegration, checklist.hasRoutingRule, checklist.hasOrder, checklist.hasRoutedOrder].filter(Boolean)
        .length
    : 0;

  const handleDismiss = async () => {
    setDismissing(true);
    try {
      await api.patch('/user/onboarding', { completed: true });
      await fetchMe();
    } catch {
      setDismissing(false);
    }
  };

  const showChecklist = user && !user.onboardingCompleted;
  const failedOrders = (failedOrdersData?.data ?? []) as FailedOrder[];

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">
          {user ? `Welcome back, ${user.firstName} 👋` : 'Dashboard'}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Here's what's happening with your orders.</p>
      </div>

      {/* ── Onboarding Checklist ── */}
      <AnimatePresence>
        {showChecklist && checklist && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12, height: 0 }}
            className="mb-8 border border-border rounded-xl overflow-hidden bg-white shadow-sm"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-gradient-to-r from-indigo-50 to-white">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                  <Rocket className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Get started with FunnelOrders</p>
                  <p className="text-xs text-muted-foreground">{completedCount} of 4 steps completed</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {/* Progress bar */}
                <div className="hidden sm:flex items-center gap-2">
                  <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-primary rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${(completedCount / 4) * 100}%` }}
                      transition={{ duration: 0.5, ease: 'easeOut' }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground">{Math.round((completedCount / 4) * 100)}%</span>
                </div>
                <button
                  onClick={handleDismiss}
                  disabled={dismissing}
                  className="p-1.5 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                  title="Dismiss checklist"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Steps */}
            <div className="p-4 space-y-2">
              <Step
                done={true}
                label="Create your account"
                description="You're in! Your FunnelOrders account is set up and ready."
                href="/settings/profile"
                cta="View profile"
              />
              <Step
                done={checklist.hasIntegration}
                label="Connect an integration"
                description="Link ClickFunnels, GoHighLevel, Kartra, WooCommerce, or Shopify."
                href="/settings/integrations"
                cta="Add integration"
              />
              <Step
                done={checklist.hasRoutingRule}
                label="Create a routing rule"
                description="Tell FunnelOrders where to send your orders automatically."
                href="/settings/routing-rules"
                cta="Create rule"
              />
              <Step
                done={checklist.hasRoutedOrder}
                label="Route your first order"
                description="Once your integration is live, orders will route automatically."
                href="/orders"
                cta="View orders"
              />
            </div>

            {allDone && (
              <div className="px-4 pb-4">
                <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                    <p className="text-sm font-medium text-green-700">You're all set! FunnelOrders is fully configured.</p>
                  </div>
                  <button
                    onClick={handleDismiss}
                    disabled={dismissing}
                    className="text-xs px-3 py-1.5 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
                  >
                    {dismissing ? 'Saving...' : 'Dismiss'}
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Failed Orders Widget ── */}
      {failedOrders.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 border border-red-200 rounded-xl overflow-hidden bg-white shadow-sm"
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-red-100 bg-red-50">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600" />
              <p className="font-semibold text-sm text-red-700">
                {failedOrders.length} order{failedOrders.length !== 1 ? 's' : ''} need attention
              </p>
            </div>
            <button
              onClick={() => router.push('/orders?status=FAILED')}
              className="text-xs text-red-600 hover:text-red-800 font-medium flex items-center gap-1"
            >
              View all <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <div className="divide-y divide-border">
            {failedOrders.map((order) => {
              const failedLog = order.routingLogs?.find((l) => l.status === 'FAILED');
              return (
                <div key={order.id} className="px-6 py-4 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {order.customerFirstName} {order.customerLastName}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {failedLog?.destination ?? 'Unknown'} ·{' '}
                      {failedLog?.errorMessage
                        ? failedLog.errorMessage.length > 60
                          ? failedLog.errorMessage.slice(0, 60) + '…'
                          : failedLog.errorMessage
                        : 'Routing failed'}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(order.receivedAt), { addSuffix: true })}
                    </span>
                    {failedLog && (
                      <button
                        onClick={async () => {
                          try {
                            await retryLog.mutateAsync({ orderId: order.id, routingLogId: failedLog.id });
                            toast.success('Retry queued');
                          } catch {
                            toast.error('Failed to queue retry');
                          }
                        }}
                        disabled={retryLog.isPending}
                        className="text-xs px-3 py-1.5 border border-border rounded-md hover:bg-accent flex items-center gap-1 disabled:opacity-50"
                      >
                        <RefreshCw className={`w-3 h-3 ${retryLog.isPending ? 'animate-spin' : ''}`} />
                        Retry
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* ── Quick Actions (shown when no issues) ── */}
      {failedOrders.length === 0 && user?.onboardingCompleted && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { icon: ShoppingBag, label: 'View Orders', href: '/orders', description: 'Monitor all incoming orders' },
            { icon: Plug, label: 'Integrations', href: '/settings/integrations', description: 'Manage connected platforms' },
            { icon: GitBranch, label: 'Routing Rules', href: '/settings/routing-rules', description: 'Configure order routing' },
          ].map(({ icon: Icon, label, href, description }) => (
            <button
              key={href}
              onClick={() => router.push(href)}
              className="bg-white border border-border rounded-xl p-5 text-left hover:border-primary/40 hover:shadow-sm transition-all group"
            >
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center mb-3 group-hover:bg-primary/20 transition-colors">
                <Icon className="w-4 h-4 text-primary" />
              </div>
              <p className="font-semibold text-sm">{label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
