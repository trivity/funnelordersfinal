import { cn } from '@/lib/utils';
import type { OrderStatus, OrderSource } from '@funnelorders/shared-types';

const statusColors: Record<string, string> = {
  RECEIVED: 'bg-blue-100 text-blue-700',
  PROCESSING: 'bg-yellow-100 text-yellow-700',
  ROUTED: 'bg-green-100 text-green-700',
  PARTIALLY_ROUTED: 'bg-orange-100 text-orange-700',
  FAILED: 'bg-red-100 text-red-700',
  ARCHIVED: 'bg-gray-100 text-gray-500',
};

const sourceColors: Record<string, string> = {
  CLICKFUNNELS: 'bg-purple-100 text-purple-700',
  GHL: 'bg-cyan-100 text-cyan-700',
  KARTRA: 'bg-indigo-100 text-indigo-700',
  MANUAL: 'bg-gray-100 text-gray-700',
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-medium', statusColors[status] ?? 'bg-gray-100 text-gray-700')}>
      {status === 'PROCESSING' && (
        <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 mr-1 animate-pulse" />
      )}
      {status.replace('_', ' ')}
    </span>
  );
}

export function SourceBadge({ source }: { source: OrderSource }) {
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-medium', sourceColors[source] ?? 'bg-gray-100 text-gray-700')}>
      {source === 'CLICKFUNNELS' ? 'CF' : source === 'GHL' ? 'GHL' : source}
    </span>
  );
}
