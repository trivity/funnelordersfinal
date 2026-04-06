'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/stores/auth.store';
import { useStoreStore } from '@/stores/store.store';
import { Sidebar } from '@/components/layout/Sidebar';
import { AlertTriangle, Zap } from 'lucide-react';

function TrialBanner({ trialEndsAt }: { trialEndsAt: string }) {
  const daysLeft = Math.max(
    0,
    Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
  );
  const expired = daysLeft === 0;

  return (
    <div className={`flex items-center justify-between px-4 py-2 text-sm ${expired ? 'bg-red-600 text-white' : 'bg-amber-500 text-white'}`}>
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 shrink-0" />
        {expired
          ? 'Your free trial has expired. Upgrade to keep access.'
          : `Free trial — ${daysLeft} day${daysLeft !== 1 ? 's' : ''} remaining.`}
      </div>
      <Link
        href="/settings/billing"
        className="flex items-center gap-1 bg-white/20 hover:bg-white/30 rounded px-3 py-1 font-medium text-xs transition-colors"
      >
        <Zap className="w-3 h-3" />
        Upgrade now
      </Link>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, fetchMe, isLoading, user } = useAuthStore();
  const { fetchStores } = useStoreStore();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated) {
      fetchMe();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (isAuthenticated) {
      void fetchStores();
    }
  }, [isAuthenticated]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading || !isAuthenticated) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  const showTrialBanner =
    user?.subscriptionStatus === 'TRIALING' &&
    user?.trialEndsAt != null;

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      {showTrialBanner && <TrialBanner trialEndsAt={user.trialEndsAt!} />}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
