'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Package, User, MapPin, Clock, ExternalLink, RefreshCw, Send, ChevronDown, Archive } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { StatusBadge, SourceBadge } from '@/components/shared/StatusBadge';
import { usePatchOrder, usePushOrder, useRetryRoutingLog, useArchiveOrder, type Order } from '@/hooks/useOrders';
import { formatCurrency } from '@/lib/utils';

interface OrderDetailSheetProps {
  order: Order | null;
  onClose: () => void;
}

export function OrderDetailSheet({ order, onClose }: OrderDetailSheetProps) {
  const [showRawPayload, setShowRawPayload] = useState(false);
  const [notes, setNotes] = useState(order?.notes ?? '');
  const patchOrder = usePatchOrder();
  const pushOrder = usePushOrder();
  const retryLog = useRetryRoutingLog();
  const archiveOrder = useArchiveOrder();
  const [confirmArchive, setConfirmArchive] = useState(false);

  if (!order) return null;

  const saveNotes = async () => {
    await patchOrder.mutateAsync({ id: order.id, notes });
    toast.success('Notes saved');
  };

  const handlePush = async (destination: string) => {
    try {
      await pushOrder.mutateAsync({ id: order.id, destination });
      toast.success(`Queued for ${destination}`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? 'Failed to queue push';
      toast.error(msg);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex justify-end"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/30" onClick={onClose} />

        {/* Sheet */}
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative w-full max-w-2xl bg-white shadow-xl overflow-y-auto flex flex-col"
        >
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-border px-6 py-4 flex items-center justify-between z-10">
            <div className="flex items-center gap-3">
              <SourceBadge source={order.source as never} />
              <StatusBadge status={order.status as never} />
              <span className="text-sm text-muted-foreground font-mono">
                {order.id.slice(0, 8)}...
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handlePush('WOOCOMMERCE')}
                className="text-xs px-3 py-1.5 border border-border rounded-md hover:bg-accent flex items-center gap-1"
              >
                <Send className="w-3 h-3" /> Push
              </button>
              <button onClick={onClose} className="p-2 hover:bg-accent rounded-md">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 p-6 space-y-6">
            {/* Customer */}
            <section>
              <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
                <User className="w-4 h-4" /> Customer
              </h3>
              <div className="bg-muted/50 rounded-md p-4 grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-muted-foreground">Name</span><p className="font-medium">{order.customerFirstName} {order.customerLastName}</p></div>
                <div><span className="text-muted-foreground">Email</span><p className="font-medium">{order.customerEmail}</p></div>
                {order.customerPhone && (
                  <div><span className="text-muted-foreground">Phone</span><p className="font-medium">{order.customerPhone}</p></div>
                )}
              </div>
            </section>

            {/* Address */}
            {order.shippingAddress && (
              <section>
                <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
                  <MapPin className="w-4 h-4" /> Shipping Address
                </h3>
                <div className="bg-muted/50 rounded-md p-4 text-sm">
                  <p>{order.shippingAddress['line1']}</p>
                  {order.shippingAddress['line2'] && <p>{order.shippingAddress['line2']}</p>}
                  <p>{order.shippingAddress['city']}, {order.shippingAddress['state']} {order.shippingAddress['zip']}</p>
                  <p>{order.shippingAddress['country']}</p>
                </div>
              </section>
            )}

            {/* Line items */}
            <section>
              <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
                <Package className="w-4 h-4" /> Line Items
              </h3>
              <div className="border border-border rounded-md overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left px-4 py-2 text-muted-foreground font-medium">Item</th>
                      <th className="text-right px-4 py-2 text-muted-foreground font-medium">Qty</th>
                      <th className="text-right px-4 py-2 text-muted-foreground font-medium">Unit Price</th>
                      <th className="text-right px-4 py-2 text-muted-foreground font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.lineItems.map((item, i) => (
                      <tr key={i} className="border-t border-border">
                        <td className="px-4 py-2">
                          <p className="font-medium">{item.name}</p>
                          {item.sku && <p className="text-xs text-muted-foreground">SKU: {item.sku}</p>}
                        </td>
                        <td className="px-4 py-2 text-right">{item.quantity}</td>
                        <td className="px-4 py-2 text-right">{formatCurrency(item.unitPrice)}</td>
                        <td className="px-4 py-2 text-right">{formatCurrency(item.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t-2 border-border bg-muted/30">
                    {order.tax != null && (
                      <tr>
                        <td colSpan={3} className="px-4 py-1 text-right text-muted-foreground text-xs">Tax</td>
                        <td className="px-4 py-1 text-right text-xs">{formatCurrency(order.tax)}</td>
                      </tr>
                    )}
                    {order.shipping != null && (
                      <tr>
                        <td colSpan={3} className="px-4 py-1 text-right text-muted-foreground text-xs">Shipping</td>
                        <td className="px-4 py-1 text-right text-xs">{formatCurrency(order.shipping)}</td>
                      </tr>
                    )}
                    <tr>
                      <td colSpan={3} className="px-4 py-2 text-right font-semibold">Total</td>
                      <td className="px-4 py-2 text-right font-semibold">{formatCurrency(order.total)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>

            {/* Routing history */}
            {order.routingLogs && order.routingLogs.length > 0 && (
              <section>
                <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
                  <Clock className="w-4 h-4" /> Routing History
                </h3>
                <div className="space-y-2">
                  {order.routingLogs.map((log) => (
                    <div key={log.id} className="border border-border rounded-md p-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{log.destination}</span>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                            log.status === 'SUCCESS' ? 'bg-green-100 text-green-700' :
                            log.status === 'FAILED' ? 'bg-red-100 text-red-700' :
                            'bg-yellow-100 text-yellow-700'
                          }`}>{log.status}</span>
                          {(log.status === 'FAILED' || log.status === 'ERROR') && (
                            <button
                              onClick={async () => {
                                try {
                                  await retryLog.mutateAsync({ orderId: order.id, routingLogId: log.id });
                                  toast.success('Retry queued');
                                } catch (err: unknown) {
                                  const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? 'Failed to queue retry';
                                  toast.error(msg);
                                }
                              }}
                              disabled={retryLog.isPending}
                              className="text-xs px-2 py-0.5 border border-border rounded hover:bg-accent flex items-center gap-1 disabled:opacity-50"
                            >
                              <RefreshCw className={`w-3 h-3 ${retryLog.isPending ? 'animate-spin' : ''}`} />
                              Retry
                            </button>
                          )}
                        </div>
                      </div>
                      {log.externalOrderId && (
                        <p className="text-muted-foreground mt-1">External ID: {log.externalOrderId}</p>
                      )}
                      {log.errorMessage && (
                        <p className="text-destructive text-xs mt-1">{log.errorMessage}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDistanceToNow(new Date(log.lastAttemptAt), { addSuffix: true })} · {log.attemptCount} attempt{log.attemptCount !== 1 ? 's' : ''}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Notes */}
            <section>
              <h3 className="text-sm font-semibold mb-3">Notes</h3>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Add notes..."
              />
              <button
                onClick={saveNotes}
                className="mt-2 text-xs px-3 py-1.5 bg-primary text-primary-foreground rounded-md"
              >
                Save notes
              </button>
            </section>

            {/* Archive */}
            {order.status !== 'ARCHIVED' && (
              <section className="border border-border rounded-md p-4">
                <h3 className="text-sm font-semibold flex items-center gap-2 mb-1">
                  <Archive className="w-4 h-4" /> Archive Order
                </h3>
                <p className="text-xs text-muted-foreground mb-3">
                  Archived orders are removed from the main Orders list and stored in the Archives page.
                </p>
                {!confirmArchive ? (
                  <button
                    onClick={() => setConfirmArchive(true)}
                    className="text-sm px-4 py-2 border border-border rounded-md hover:bg-accent transition-colors flex items-center gap-2"
                  >
                    <Archive className="w-3.5 h-3.5" /> Archive this order
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Are you sure?</span>
                    <button
                      onClick={async () => {
                        try {
                          await archiveOrder.mutateAsync(order.id);
                          toast.success('Order archived');
                          onClose();
                        } catch {
                          toast.error('Failed to archive order');
                        }
                      }}
                      disabled={archiveOrder.isPending}
                      className="text-sm px-3 py-1.5 bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90 disabled:opacity-50"
                    >
                      {archiveOrder.isPending ? 'Archiving...' : 'Yes, archive'}
                    </button>
                    <button
                      onClick={() => setConfirmArchive(false)}
                      className="text-sm px-3 py-1.5 border border-border rounded-md hover:bg-accent"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </section>
            )}

            {/* Raw payload */}
            <section>
              <button
                onClick={() => setShowRawPayload(!showRawPayload)}
                className="flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
              >
                <ChevronDown className={`w-4 h-4 transition-transform ${showRawPayload ? 'rotate-180' : ''}`} />
                Raw Payload
              </button>
              {showRawPayload && (
                <pre className="mt-2 bg-muted/50 rounded-md p-4 text-xs overflow-auto max-h-64">
                  {JSON.stringify(order.rawPayload, null, 2)}
                </pre>
              )}
            </section>

            <p className="text-xs text-muted-foreground">
              Received {format(new Date(order.receivedAt), 'PPpp')}
            </p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
