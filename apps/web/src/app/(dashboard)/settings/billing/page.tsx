'use client';

import { useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { CheckCircle2, CreditCard, Store, Zap, Infinity } from 'lucide-react';
import api from '@/lib/api';
import { fireConfetti } from '@/lib/confetti';
import { cn } from '@/lib/utils';

interface Plan {
  tier: string;
  name: string;
  price: number;
  maxStores: number | null;
  features: string[];
}

interface Subscription {
  planTier: string;
  subscriptionStatus: string;
  planCurrentPeriodEnd?: string;
  maxStores?: number;
}

const PLAN_STORE_LABEL: Record<string, { label: string; icon: React.ReactNode }> = {
  STARTER: { label: '1 store environment', icon: <Store className="w-4 h-4" /> },
  GROWTH:  { label: 'Up to 5 store environments', icon: <Store className="w-4 h-4" /> },
  AGENCY:  { label: 'Unlimited store environments', icon: <Infinity className="w-4 h-4" /> },
};

export default function BillingPage() {
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get('success') === '1') {
      toast.success('Subscription activated!');
      fireConfetti.fullScreen();
    }
    if (searchParams.get('canceled') === '1') {
      toast.info('Checkout canceled');
    }
  }, [searchParams]);

  const { data: plans = [] } = useQuery<Plan[]>({
    queryKey: ['billing-plans'],
    queryFn: async () => {
      const { data } = await api.get('/billing/plans');
      return data.data as Plan[];
    },
  });

  const { data: sub } = useQuery<Subscription>({
    queryKey: ['subscription'],
    queryFn: async () => {
      const { data } = await api.get('/billing/subscription');
      return data.data as Subscription;
    },
  });

  const checkoutMutation = useMutation({
    mutationFn: async (planTier: string) => {
      const { data } = await api.post('/billing/create-checkout-session', { planTier });
      return data.data.url as string;
    },
    onSuccess: (url) => { window.location.href = url; },
    onError: () => toast.error('Failed to start checkout'),
  });

  const portalMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/billing/create-portal-session');
      return data.data.url as string;
    },
    onSuccess: (url) => { window.location.href = url; },
  });

  const PLAN_ORDER = ['STARTER', 'GROWTH', 'AGENCY'];
  const sortedPlans = [...plans].sort(
    (a, b) => PLAN_ORDER.indexOf(a.tier) - PLAN_ORDER.indexOf(b.tier),
  );

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Billing</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage your subscription and store environments.</p>
      </div>

      {/* Current plan banner */}
      {sub && (
        <div className="mb-8 border border-border rounded-lg p-5 bg-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CreditCard className="w-5 h-5 text-primary" />
            <div>
              <p className="font-semibold">{sub.planTier} Plan</p>
              <p className="text-sm text-muted-foreground capitalize">{sub.subscriptionStatus.toLowerCase()}</p>
            </div>
            {sub.maxStores && (
              <div className="ml-2 flex items-center gap-1.5 text-xs text-muted-foreground border border-border rounded-full px-3 py-1">
                <Store className="w-3.5 h-3.5" />
                {sub.maxStores >= 999 ? 'Unlimited stores' : `${sub.maxStores} store${sub.maxStores > 1 ? 's' : ''}`}
              </div>
            )}
          </div>
          {sub.subscriptionStatus === 'ACTIVE' && (
            <button
              onClick={() => portalMutation.mutate()}
              disabled={portalMutation.isPending}
              className="text-sm px-4 py-2 border border-border rounded-md hover:bg-accent"
            >
              Manage subscription
            </button>
          )}
        </div>
      )}

      {/* Plans grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {sortedPlans.map((plan) => {
          const isCurrent = sub?.planTier === plan.tier;
          const isGrowth = plan.tier === 'GROWTH';
          const storeInfo = PLAN_STORE_LABEL[plan.tier];

          return (
            <div
              key={plan.tier}
              className={cn(
                'border rounded-2xl p-6 bg-white flex flex-col relative',
                isGrowth ? 'border-primary ring-2 ring-primary/20 scale-[1.02]' : 'border-border',
                isCurrent && !isGrowth && 'border-primary/50',
              )}
            >
              {isGrowth && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full">
                  Most Popular
                </span>
              )}
              {isCurrent && (
                <span className="text-xs font-medium text-primary mb-2 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Current plan
                </span>
              )}

              <h3 className="font-bold text-lg">{plan.name}</h3>
              <div className="mt-1 mb-4">
                <span className="text-3xl font-bold">${plan.price}</span>
                <span className="text-sm font-normal text-muted-foreground">/mo</span>
              </div>

              {/* Store limit highlight */}
              {storeInfo && (
                <div className={cn(
                  'flex items-center gap-2 text-sm font-medium rounded-lg px-3 py-2 mb-4',
                  isGrowth ? 'bg-primary/10 text-primary' : 'bg-muted/50 text-foreground',
                )}>
                  {storeInfo.icon}
                  {storeInfo.label}
                </div>
              )}

              <ul className="space-y-2.5 flex-1 mb-6">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
                <li className="flex items-start gap-2 text-sm">
                  <Zap className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  Unlimited workflows
                </li>
              </ul>

              {isCurrent ? (
                <div className="w-full text-center py-2 text-sm text-muted-foreground border border-border rounded-md">
                  Active plan
                </div>
              ) : (
                <button
                  onClick={() => checkoutMutation.mutate(plan.tier)}
                  disabled={checkoutMutation.isPending}
                  className={cn(
                    'w-full rounded-md py-2.5 text-sm font-semibold transition-colors disabled:opacity-50',
                    isGrowth
                      ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                      : 'border border-border hover:bg-accent',
                  )}
                >
                  {checkoutMutation.isPending ? 'Loading...' : `Get ${plan.name}`}
                </button>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground mt-6 text-center">
        All plans include unlimited workflows and automated routing. Cancel anytime.
      </p>
    </div>
  );
}
