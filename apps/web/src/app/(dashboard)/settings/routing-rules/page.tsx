'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { GitBranch, Plus, Pencil, Trash2, X, ToggleLeft, ToggleRight, ShoppingCart, ShoppingBag } from 'lucide-react';
import api from '@/lib/api';
import { cn } from '@/lib/utils';

interface RoutingRule {
  id: string;
  name: string;
  active: boolean;
  priority: number;
  sourceFilter?: string;
  destination: string;
  destinations: string[];
  matchCount: number;
  lastMatchedAt?: string;
}

const DESTINATIONS = [
  { key: 'WOOCOMMERCE', label: 'WooCommerce', icon: ShoppingCart, color: 'bg-purple-100 text-purple-700 border-purple-200' },
  { key: 'SHOPIFY', label: 'Shopify', icon: ShoppingBag, color: 'bg-green-100 text-green-700 border-green-200' },
];

const SOURCE_LABELS: Record<string, string> = {
  CLICKFUNNELS: 'ClickFunnels',
  GHL: 'GoHighLevel',
  KARTRA: 'Kartra',
  MANUAL: 'Manual',
};

export default function RoutingRulesPage() {
  const qc = useQueryClient();
  const [editingRule, setEditingRule] = useState<RoutingRule | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Form state
  const [formName, setFormName] = useState('');
  const [formSource, setFormSource] = useState('');
  const [formActive, setFormActive] = useState(true);
  const [formDestinations, setFormDestinations] = useState<string[]>([]);

  const { data: rules = [] } = useQuery<RoutingRule[]>({
    queryKey: ['routing-rules'],
    queryFn: async () => {
      const { data } = await api.get('/routing-rules');
      return data.data as RoutingRule[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (body: { name: string; sourceFilter?: string; destinations: string[]; active: boolean }) =>
      api.post('/routing-rules', body),
    onSuccess: () => {
      toast.success('Workflow created');
      closeForm();
      void qc.invalidateQueries({ queryKey: ['routing-rules'] });
    },
    onError: () => toast.error('Failed to create workflow'),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...body }: { id: string; name: string; sourceFilter?: string; destinations: string[]; active: boolean }) =>
      api.put(`/routing-rules/${id}`, body),
    onSuccess: () => {
      toast.success('Workflow updated');
      closeForm();
      void qc.invalidateQueries({ queryKey: ['routing-rules'] });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) =>
      api.patch(`/routing-rules/${id}`, { active }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['routing-rules'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/routing-rules/${id}`),
    onSuccess: () => {
      toast.success('Workflow deleted');
      void qc.invalidateQueries({ queryKey: ['routing-rules'] });
    },
  });

  const closeForm = () => {
    setIsCreating(false);
    setEditingRule(null);
    setFormName('');
    setFormSource('');
    setFormActive(true);
    setFormDestinations([]);
  };

  const openCreate = () => {
    setFormName('');
    setFormSource('');
    setFormActive(true);
    setFormDestinations([]);
    setEditingRule(null);
    setIsCreating(true);
  };

  const openEdit = (rule: RoutingRule) => {
    const dests = rule.destinations?.length > 0 ? rule.destinations : [rule.destination];
    setFormName(rule.name);
    setFormSource(rule.sourceFilter ?? '');
    setFormActive(rule.active);
    setFormDestinations(dests);
    setEditingRule(rule);
    setIsCreating(false);
  };

  const toggleDestination = (key: string) => {
    setFormDestinations((prev) =>
      prev.includes(key) ? prev.filter((d) => d !== key) : [...prev, key],
    );
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formDestinations.length === 0) {
      toast.error('Select at least one destination');
      return;
    }
    const body = {
      name: formName,
      sourceFilter: formSource || undefined,
      destinations: formDestinations,
      active: formActive,
    };
    if (editingRule) {
      updateMutation.mutate({ ...body, id: editingRule.id });
    } else {
      createMutation.mutate(body);
    }
  };

  const getRuleDests = (rule: RoutingRule) =>
    rule.destinations?.length > 0 ? rule.destinations : [rule.destination];

  const isFormOpen = isCreating || !!editingRule;
  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Workflows</h1>
          <p className="text-muted-foreground text-sm mt-1">Define where orders are sent based on their source.</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium"
        >
          <Plus className="w-4 h-4" /> New Workflow
        </button>
      </div>

      {rules.length === 0 && !isFormOpen ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground border border-dashed border-border rounded-lg">
          <GitBranch className="w-10 h-10 mb-3 opacity-30" />
          <p className="font-medium">No workflows yet</p>
          <p className="text-sm mt-1">Create a workflow to automatically route orders to your fulfillment platforms.</p>
          <button onClick={openCreate} className="mt-4 text-sm text-primary hover:underline">
            Create your first workflow
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => {
            const dests = getRuleDests(rule);
            return (
              <motion.div
                key={rule.id}
                layout
                className={cn(
                  'border rounded-lg p-4 bg-white flex items-center justify-between gap-4',
                  rule.active ? 'border-border' : 'border-border opacity-60',
                )}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    onClick={() => toggleMutation.mutate({ id: rule.id, active: !rule.active })}
                    className="shrink-0"
                  >
                    {rule.active ? (
                      <ToggleRight className="w-6 h-6 text-primary" />
                    ) : (
                      <ToggleLeft className="w-6 h-6 text-muted-foreground" />
                    )}
                  </button>
                  <div className="min-w-0">
                    <p className="font-medium text-sm">{rule.name}</p>
                    <div className="flex items-center gap-1.5 flex-wrap mt-1">
                      <span className="text-xs text-muted-foreground">
                        IF {rule.sourceFilter ? SOURCE_LABELS[rule.sourceFilter] ?? rule.sourceFilter : 'any source'} → PUSH TO
                      </span>
                      {dests.map((d) => {
                        const meta = DESTINATIONS.find((x) => x.key === d);
                        return meta ? (
                          <span key={d} className={cn('inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded border font-medium', meta.color)}>
                            <meta.icon className="w-3 h-3" />
                            {meta.label}
                          </span>
                        ) : (
                          <span key={d} className="text-xs text-muted-foreground">{d}</span>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 shrink-0">
                  <div className="text-right hidden sm:block">
                    <p className="text-xs font-medium">{rule.matchCount} matched</p>
                    {rule.lastMatchedAt && (
                      <p className="text-xs text-muted-foreground">
                        {new Date(rule.lastMatchedAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(rule)} className="p-2 hover:bg-accent rounded-md">
                      <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                    <button
                      onClick={() => { if (confirm('Delete this workflow?')) deleteMutation.mutate(rule.id); }}
                      className="p-2 hover:bg-destructive/10 rounded-md"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Slide-out form panel */}
      <AnimatePresence>
        {isFormOpen && (
          <motion.div
            className="fixed inset-0 z-50 flex justify-end"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/30" onClick={closeForm} />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative w-full max-w-md bg-white shadow-xl p-6 flex flex-col gap-4 overflow-y-auto"
            >
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">{editingRule ? 'Edit Workflow' : 'New Workflow'}</h2>
                <button onClick={closeForm}>
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>

              <form onSubmit={onSubmit} className="space-y-5">
                {/* Name */}
                <div>
                  <label className="block text-sm font-medium mb-1">Rule Name</label>
                  <input
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    required
                    className="w-full border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="e.g., CF to WooCommerce"
                  />
                </div>

                {/* Source Filter */}
                <div>
                  <label className="block text-sm font-medium mb-1">Source Filter</label>
                  <select
                    value={formSource}
                    onChange={(e) => setFormSource(e.target.value)}
                    className="w-full border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">Any source</option>
                    <option value="CLICKFUNNELS">ClickFunnels</option>
                    <option value="GHL">GoHighLevel</option>
                    <option value="KARTRA">Kartra</option>
                    <option value="MANUAL">Manual</option>
                  </select>
                </div>

                {/* Send To — multi-select checkboxes */}
                <div>
                  <label className="block text-sm font-medium mb-2">Send To</label>
                  <div className="space-y-2">
                    {DESTINATIONS.map(({ key, label, icon: Icon, color }) => {
                      const checked = formDestinations.includes(key);
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => toggleDestination(key)}
                          className={cn(
                            'w-full flex items-center gap-3 px-4 py-3 rounded-lg border-2 transition-all text-left',
                            checked
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-border bg-white hover:bg-muted/40',
                          )}
                        >
                          {/* Checkbox */}
                          <div className={cn(
                            'w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors',
                            checked ? 'bg-blue-500 border-blue-500' : 'border-gray-300 bg-white',
                          )}>
                            {checked && (
                              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>

                          {/* Platform icon */}
                          <div className={cn('w-8 h-8 rounded-md flex items-center justify-center shrink-0', color.split(' ').slice(0, 2).join(' '))}>
                            <Icon className="w-4 h-4" />
                          </div>

                          <span className="text-sm font-medium">{label}</span>
                        </button>
                      );
                    })}
                  </div>
                  {formDestinations.length === 0 && (
                    <p className="text-xs text-muted-foreground mt-1.5">Select at least one destination</p>
                  )}
                </div>

                {/* Active toggle */}
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="active"
                    checked={formActive}
                    onChange={(e) => setFormActive(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <label htmlFor="active" className="text-sm font-medium">Active</label>
                </div>

                <div className="flex gap-3 pt-1">
                  <button
                    type="submit"
                    disabled={isPending || formDestinations.length === 0}
                    className="flex-1 bg-primary text-primary-foreground rounded-md py-2 text-sm font-medium disabled:opacity-50"
                  >
                    {isPending ? 'Saving...' : editingRule ? 'Update Workflow' : 'Create Workflow'}
                  </button>
                  <button
                    type="button"
                    onClick={closeForm}
                    className="px-4 py-2 border border-border rounded-md text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
