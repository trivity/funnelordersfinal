'use client';

import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plug, CheckCircle2, XCircle, Clock, Copy, X, ExternalLink, ArrowDownToLine, ArrowUpFromLine, RefreshCw, Eye, EyeOff, Map, ChevronLeft } from 'lucide-react';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import { fireConfetti } from '@/lib/confetti';

interface Integration {
  id: string;
  platform: string;
  direction: string;
  label?: string;
  status: string;
  webhookUrl?: string;
  lastUsedAt?: string;
  errorMessage?: string;
  fieldMappings?: Record<string, string>;
}

interface MappingData {
  suggestions: Record<string, string>;
  sampleValues: Record<string, string>;
  destFields: string[];
  sourceFields: Array<{ key: string; label: string }>;
  platform: string;
}

interface PlatformMeta {
  name: string;
  direction: 'INBOUND' | 'OUTBOUND';
  fields: { key: string; label: string; type?: string; placeholder?: string }[];
  guide: { title: string; steps: string[]; docsUrl?: string };
}

const PLATFORM_META: Record<string, PlatformMeta> = {
  CLICKFUNNELS: {
    name: 'ClickFunnels',
    direction: 'INBOUND',
    fields: [], // webhook-based — no credentials needed
    guide: {
      title: 'How to set up the ClickFunnels webhook',
      steps: [
        'Click "Connect" — FunnelOrders generates a unique Webhook URL. Copy it from the card.',
        'In ClickFunnels go to Workspace Settings → Webhooks → New.',
        'Name: enter "FunnelOrders" (or any label you like).',
        'URL: paste the Webhook URL you copied from FunnelOrders.',
        'Event types: type "order" and select "order" from the suggestions (this fires on every new purchase).',
        'API Version: leave as V2.',
        'Endpoint scopes (Funnels / Pages): leave blank to capture all funnels, or pick specific ones.',
        'Click "Create endpoint". Orders will now appear in FunnelOrders automatically.',
      ],
      docsUrl: 'https://help.clickfunnels.com',
    },
  },
  GHL: {
    name: 'GoHighLevel',
    direction: 'INBOUND',
    fields: [
      { key: 'locationApiKey', label: 'Location API Key', placeholder: 'eyJ...' },
      { key: 'locationId', label: 'Location ID (optional)', placeholder: 'e.g. abc123xyz' },
    ],
    guide: {
      title: 'How to find your GoHighLevel credentials',
      steps: [
        'Log in to your GHL sub-account (not the agency dashboard).',
        'Go to Settings → Integrations → API Keys.',
        'Click Create API Key, give it a name, and copy the key.',
        'Your Location ID is shown in the URL of your sub-account (e.g. /location/abc123xyz/dashboard).',
      ],
      docsUrl: 'https://help.gohighlevel.com',
    },
  },
  KARTRA: {
    name: 'Kartra',
    direction: 'INBOUND',
    fields: [
      { key: 'apiKey', label: 'API Key', placeholder: 'Enter API key' },
      { key: 'appId', label: 'App ID', placeholder: 'Enter App ID' },
      { key: 'apiPassword', label: 'API Password', type: 'password', placeholder: '••••••••' },
    ],
    guide: {
      title: 'How to find your Kartra credentials',
      steps: [
        'Log in to your Kartra account.',
        'Click your profile icon → My Profile.',
        'Scroll to the API Keys section.',
        'If no key exists, click Generate API Key.',
        'Copy the API Key, App ID, and API Password shown there.',
      ],
      docsUrl: 'https://support.kartra.com',
    },
  },
  WOOCOMMERCE: {
    name: 'WooCommerce',
    direction: 'OUTBOUND',
    fields: [
      { key: 'storeUrl', label: 'Store URL', placeholder: 'https://yourstore.com' },
      { key: 'consumerKey', label: 'Consumer Key', placeholder: 'ck_...' },
      { key: 'consumerSecret', label: 'Consumer Secret', type: 'password', placeholder: 'cs_...' },
    ],
    guide: {
      title: 'How to generate WooCommerce API keys',
      steps: [
        'Log in to your WordPress Admin dashboard.',
        'Go to WooCommerce → Settings → Advanced → REST API.',
        'Click Add Key.',
        'Set Description, User, and Permissions to Read/Write.',
        'Click Generate API Key and copy both the Consumer Key and Consumer Secret.',
        'Your Store URL is your WordPress site root (e.g. https://yourstore.com).',
      ],
      docsUrl: 'https://woocommerce.com/document/woocommerce-rest-api/',
    },
  },
  SHOPIFY: {
    name: 'Shopify',
    direction: 'OUTBOUND',
    fields: [
      { key: 'storeDomain', label: 'Store Domain', placeholder: 'mystore.myshopify.com' },
      { key: 'adminApiToken', label: 'Admin API Token', type: 'password', placeholder: 'shpat_...' },
    ],
    guide: {
      title: 'How to get your Shopify Admin API token',
      steps: [
        'Log in to your Shopify Admin. Go to Settings → Apps.',
        'Click "Develop apps" in the top right corner.',
        'Click "Allow legacy custom app development", then click "Create an app".',
        'Give the app a name (e.g. FunnelOrders) and click Create app.',
        'Click the "API credentials" tab, then click "Configure Admin API scopes".',
        'In the filter box type "orders" — check write_orders and read_orders. Click Save.',
        'Back on the API credentials tab, click "Install app" at the top and confirm.',
        'The Admin API access token now appears — copy it immediately (it is only shown once). It starts with shpat_.',
        'Enter your token above and set Store Domain to your .myshopify.com URL (e.g. mystore.myshopify.com).',
      ],
      docsUrl: 'https://help.shopify.com/en/manual/apps/app-types/custom-apps',
    },
  },
};

const ALL_PLATFORMS = ['CLICKFUNNELS', 'GHL', 'KARTRA', 'WOOCOMMERCE', 'SHOPIFY'];

export default function IntegrationsPage() {
  const qc = useQueryClient();
  const [connectingPlatform, setConnectingPlatform] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [showGuide, setShowGuide] = useState<string | null>(null);
  const [revealedFields, setRevealedFields] = useState<Record<string, boolean>>({});
  const cardRef = useRef<HTMLDivElement>(null);

  // Mapping step state
  const [mappingStep, setMappingStep] = useState(false);
  const [mappingData, setMappingData] = useState<MappingData | null>(null);
  const [customMappings, setCustomMappings] = useState<Record<string, string>>({});
  const [connectedIntegrationId, setConnectedIntegrationId] = useState<string | null>(null);
  const [mappingLoading, setMappingLoading] = useState(false);

  const { data: integrations = [] } = useQuery<Integration[]>({
    queryKey: ['integrations'],
    queryFn: async () => {
      const { data } = await api.get('/integrations');
      return data.data as Integration[];
    },
  });

  const loadMappingSuggestions = async (integrationId: string) => {
    setMappingLoading(true);
    try {
      const { data } = await api.get(`/integrations/${integrationId}/mapping-suggestions`);
      const md = data.data as MappingData;
      setMappingData(md);
      setCustomMappings(md.suggestions);
      setMappingStep(true);
    } catch {
      toast.error('Could not load mapping suggestions');
    } finally {
      setMappingLoading(false);
    }
  };

  const saveMappingsMutation = useMutation({
    mutationFn: async ({ id, mappings }: { id: string; mappings: Record<string, string> }) => {
      await api.patch(`/integrations/${id}/mappings`, { mappings });
    },
    onSuccess: () => {
      toast.success('Field mappings saved!');
      setConnectingPlatform(null);
      setMappingStep(false);
      setMappingData(null);
      setCustomMappings({});
      setConnectedIntegrationId(null);
      setFormValues({});
      void qc.invalidateQueries({ queryKey: ['integrations'] });
    },
    onError: () => {
      toast.error('Failed to save mappings');
    },
  });

  const closeDrawer = () => {
    setConnectingPlatform(null);
    setMappingStep(false);
    setMappingData(null);
    setCustomMappings({});
    setConnectedIntegrationId(null);
    setFormValues({});
  };

  const createMutation = useMutation({
    mutationFn: async ({ platform, credentials }: { platform: string; credentials: Record<string, string> }) => {
      const { data } = await api.post('/integrations', { platform, credentials });
      return data.data as Integration;
    },
    onSuccess: async (integration) => {
      const platformName = PLATFORM_META[integration.platform]?.name ?? integration.platform;
      const isWebhookOnly = PLATFORM_META[integration.platform]?.fields.length === 0;
      const isOutbound = PLATFORM_META[integration.platform]?.direction === 'OUTBOUND';
      let testPassed = false;
      try {
        const { data } = await api.post(`/integrations/${integration.id}/test`);
        testPassed = data.data.success as boolean;
        if (testPassed) {
          toast.success(`${platformName} connected!`);
          if (cardRef.current) fireConfetti.fromElement(cardRef.current);
          else fireConfetti.fullScreen();
        } else {
          toast.error(`Connected but test failed: ${String(data.data.message)}`);
        }
      } catch {
        toast.warning('Integration saved. Connection test failed.');
      }
      void qc.invalidateQueries({ queryKey: ['integrations'] });
      // Show mapping step for outbound integrations after successful connection
      if (isOutbound && testPassed) {
        setConnectedIntegrationId(integration.id);
        await loadMappingSuggestions(integration.id);
      } else if (!isWebhookOnly) {
        setConnectingPlatform(null);
        setFormValues({});
      }
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? 'Failed to connect';
      toast.error(msg);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/integrations/${id}`),
    onSuccess: () => {
      toast.success('Integration disconnected');
      void qc.invalidateQueries({ queryKey: ['integrations'] });
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? 'Failed to disconnect';
      toast.error(msg);
    },
  });

  const testMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post(`/integrations/${id}/test`);
      return data.data as { success: boolean; message: string };
    },
    onSuccess: (result) => {
      if (result.success) {
        toast.success('Connection verified!');
      } else {
        toast.error(`Test failed: ${result.message}`);
      }
      void qc.invalidateQueries({ queryKey: ['integrations'] });
    },
    onError: () => {
      toast.error('Test failed — check your credentials');
      void qc.invalidateQueries({ queryKey: ['integrations'] });
    },
  });

  const handleConnect = (e: React.FormEvent) => {
    e.preventDefault();
    if (!connectingPlatform) return;
    createMutation.mutate({ platform: connectingPlatform, credentials: formValues });
  };

  const getIntegrationForPlatform = (platform: string) =>
    integrations.find((i) => i.platform === platform);

  const inbound = ALL_PLATFORMS.filter((p) => PLATFORM_META[p]!.direction === 'INBOUND');
  const outbound = ALL_PLATFORMS.filter((p) => PLATFORM_META[p]!.direction === 'OUTBOUND');

  const renderCard = (platform: string) => {
    const meta = PLATFORM_META[platform]!;
    const existing = getIntegrationForPlatform(platform);
    const isInbound = meta.direction === 'INBOUND';
    const isOutbound = meta.direction === 'OUTBOUND';

    return (
      <div key={platform} ref={cardRef} className="border border-border rounded-lg p-5 bg-white flex flex-col gap-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Plug className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">{meta.name}</h3>
              <span className={cn(
                'inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded font-medium mt-0.5',
                isInbound ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700',
              )}>
                {isInbound ? <ArrowDownToLine className="w-3 h-3" /> : <ArrowUpFromLine className="w-3 h-3" />}
                {isInbound ? 'INBOUND' : 'OUTBOUND'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {existing ? (
              <>
                {existing.status === 'CONNECTED' && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                {existing.status === 'ERROR' && <XCircle className="w-4 h-4 text-red-500" />}
                {existing.status === 'DISCONNECTED' && <Clock className="w-4 h-4 text-gray-400" />}
                <span className="text-xs text-muted-foreground">{existing.status}</span>
              </>
            ) : (
              <span className="text-xs text-muted-foreground">Not connected</span>
            )}
          </div>
        </div>

        {/* Webhook URL for inbound */}
        {existing?.webhookUrl && isInbound && (
          <div className="bg-muted/50 rounded-md p-3">
            <p className="text-xs font-medium text-muted-foreground mb-1">Webhook URL — paste this into {meta.name}</p>
            <div className="flex items-center gap-2">
              <code className="text-xs flex-1 truncate">{existing.webhookUrl}</code>
              <button
                onClick={() => { void navigator.clipboard.writeText(existing.webhookUrl!); toast.success('Copied!'); }}
                className="shrink-0"
              >
                <Copy className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            </div>
          </div>
        )}

        {existing?.errorMessage && (
          <p className="text-xs text-destructive">{existing.errorMessage}</p>
        )}

        <div className="flex gap-2 items-center flex-wrap">
          {!existing ? (
            <button
              onClick={() => {
                setConnectingPlatform(platform);
                setMappingStep(false);
                setFormValues({});
                setShowGuide(platform);
              }}
              disabled={createMutation.isPending}
              className="text-sm px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              Connect
            </button>
          ) : (
            <>
              {existing.status !== 'CONNECTED' && meta.fields.length > 0 && (
                <button
                  onClick={() => testMutation.mutate(existing.id)}
                  disabled={testMutation.isPending}
                  className="text-sm px-3 py-2 border border-border rounded-md hover:bg-accent transition-colors flex items-center gap-1.5 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${testMutation.isPending ? 'animate-spin' : ''}`} />
                  {testMutation.isPending ? 'Testing...' : 'Test Connection'}
                </button>
              )}
              {isOutbound && existing.status === 'CONNECTED' && (
                <button
                  onClick={async () => {
                    setConnectingPlatform(platform);
                    setConnectedIntegrationId(existing.id);
                    await loadMappingSuggestions(existing.id);
                  }}
                  className="text-sm px-3 py-2 border border-border rounded-md hover:bg-accent transition-colors flex items-center gap-1.5"
                >
                  <Map className="w-3.5 h-3.5" />
                  Edit Mappings
                </button>
              )}
              <button
                onClick={() => deleteMutation.mutate(existing.id)}
                className="text-sm px-4 py-2 border border-destructive text-destructive rounded-md hover:bg-destructive/10 transition-colors"
              >
                Disconnect
              </button>
            </>
          )}
        </div>
      </div>
    );
  };

  const activePlatform = connectingPlatform ? PLATFORM_META[connectingPlatform] : null;

  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Integrations</h1>
        <p className="text-muted-foreground text-sm mt-1">Connect your funnel and fulfillment platforms.</p>
      </div>

      {/* Inbound */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <ArrowDownToLine className="w-4 h-4 text-blue-600" />
          <h2 className="text-sm font-semibold text-blue-700 uppercase tracking-wide">Inbound — Order Sources</h2>
        </div>
        <p className="text-xs text-muted-foreground mb-4">These platforms send orders into FunnelOrders via webhooks.</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {inbound.map(renderCard)}
        </div>
      </div>

      {/* Outbound */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <ArrowUpFromLine className="w-4 h-4 text-green-600" />
          <h2 className="text-sm font-semibold text-green-700 uppercase tracking-wide">Outbound — Fulfillment Destinations</h2>
        </div>
        <p className="text-xs text-muted-foreground mb-4">FunnelOrders pushes orders to these platforms via your Workflows.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {outbound.map(renderCard)}
        </div>
      </div>

      {/* Connect / Mapping drawer */}
      <AnimatePresence>
        {connectingPlatform && activePlatform && (
          <motion.div
            className="fixed inset-0 z-50 flex justify-end"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/30" onClick={closeDrawer} />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative w-full max-w-md bg-white shadow-xl flex flex-col overflow-y-auto"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-5 border-b border-border shrink-0">
                <div className="flex items-center gap-3">
                  {mappingStep && (
                    <button
                      onClick={() => setMappingStep(false)}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                  )}
                  <div>
                    <h2 className="font-semibold">
                      {mappingStep ? 'Map Your Fields' : `Connect ${activePlatform.name}`}
                    </h2>
                    {mappingStep ? (
                      <p className="text-xs text-muted-foreground mt-0.5">We've auto-detected the best matches. Review and adjust.</p>
                    ) : (
                      <span className={cn(
                        'inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded font-medium mt-1',
                        activePlatform.direction === 'INBOUND' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700',
                      )}>
                        {activePlatform.direction === 'INBOUND'
                          ? <><ArrowDownToLine className="w-3 h-3" /> INBOUND</>
                          : <><ArrowUpFromLine className="w-3 h-3" /> OUTBOUND</>}
                      </span>
                    )}
                  </div>
                </div>
                <button onClick={closeDrawer}>
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>

              <div className="px-6 py-5 flex flex-col gap-5 flex-1">
                {/* Field mapping step */}
                {mappingStep && mappingData ? (
                  <div className="flex flex-col gap-4">
                    {/* Step indicator */}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="w-5 h-5 rounded-full bg-green-100 text-green-600 flex items-center justify-center font-bold text-[10px]">1</span>
                      <span className="text-green-600 font-medium">Connected</span>
                      <span className="flex-1 border-t border-border" />
                      <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-[10px]">2</span>
                      <span className="font-medium text-foreground">Map Fields</span>
                    </div>

                    {/* Mapping rows */}
                    <div className="space-y-2">
                      {mappingData.sourceFields.map((field) => {
                        const suggested = mappingData.suggestions[field.key];
                        const currentDest = customMappings[field.key] ?? '';
                        const sampleVal = mappingData.sampleValues[field.key];
                        const hasAutoSuggestion = Boolean(suggested);

                        return (
                          <div key={field.key} className="border border-border rounded-md p-3 bg-white">
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-sm font-medium truncate">{field.label}</span>
                                  {hasAutoSuggestion ? (
                                    <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 font-semibold">Auto</span>
                                  ) : (
                                    <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700 font-semibold">Review</span>
                                  )}
                                </div>
                                {sampleVal && (
                                  <p className="text-xs text-muted-foreground mt-0.5 truncate" title={sampleVal}>
                                    e.g. {sampleVal}
                                  </p>
                                )}
                              </div>
                            </div>
                            <select
                              value={currentDest}
                              onChange={(e) => {
                                const val = e.target.value;
                                setCustomMappings((prev) => {
                                  const next = { ...prev };
                                  if (val) {
                                    next[field.key] = val;
                                  } else {
                                    delete next[field.key];
                                  }
                                  return next;
                                });
                              }}
                              className="w-full border border-input rounded-md px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring bg-white"
                            >
                              <option value="">(unmapped)</option>
                              {mappingData.destFields.map((dest) => (
                                <option key={dest} value={dest}>{dest}</option>
                              ))}
                            </select>
                          </div>
                        );
                      })}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-2 pt-2">
                      <button
                        onClick={() => {
                          if (!connectedIntegrationId) return;
                          saveMappingsMutation.mutate({ id: connectedIntegrationId, mappings: customMappings });
                        }}
                        disabled={saveMappingsMutation.isPending}
                        className="w-full bg-primary text-primary-foreground rounded-md py-2 text-sm font-medium disabled:opacity-50"
                      >
                        {saveMappingsMutation.isPending ? 'Saving...' : 'Save Mapping'}
                      </button>
                      <button
                        type="button"
                        onClick={closeDrawer}
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors text-center py-1"
                      >
                        Skip for now
                      </button>
                    </div>
                  </div>
                ) : mappingLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" />
                    <span className="ml-2 text-sm text-muted-foreground">Loading suggestions...</span>
                  </div>
                ) : (
                  <>
                    {/* Webhook-only platform: show URL if already connected, else connect button */}
                    {activePlatform.fields.length === 0 ? (
                      <div className="space-y-4">
                        {(() => {
                          const existing = getIntegrationForPlatform(connectingPlatform!);
                          return existing?.webhookUrl ? (
                            <div className="bg-muted/50 rounded-md p-3">
                              <p className="text-xs font-medium text-muted-foreground mb-1">Your Webhook URL — paste this into {activePlatform.name}</p>
                              <div className="flex items-center gap-2">
                                <code className="text-xs flex-1 break-all">{existing.webhookUrl}</code>
                                <button
                                  onClick={() => { void navigator.clipboard.writeText(existing.webhookUrl!); toast.success('Copied!'); }}
                                  className="shrink-0"
                                >
                                  <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex gap-3">
                              <button
                                onClick={() => createMutation.mutate({ platform: connectingPlatform!, credentials: {} })}
                                disabled={createMutation.isPending}
                                className="flex-1 bg-primary text-primary-foreground rounded-md py-2 text-sm font-medium disabled:opacity-50"
                              >
                                {createMutation.isPending ? 'Generating...' : 'Generate Webhook URL'}
                              </button>
                              <button
                                type="button"
                                onClick={closeDrawer}
                                className="px-4 py-2 border border-border rounded-md text-sm"
                              >
                                Cancel
                              </button>
                            </div>
                          );
                        })()}
                      </div>
                    ) : (
                      /* Credential form for platforms with fields */
                      <form onSubmit={handleConnect} className="space-y-4">
                        {activePlatform.fields.map((field) => {
                          const isPassword = field.type === 'password';
                          const isRevealed = revealedFields[field.key] ?? false;
                          return (
                            <div key={field.key}>
                              <label className="block text-sm font-medium mb-1">{field.label}</label>
                              <div className="relative">
                                <input
                                  type={isPassword && !isRevealed ? 'password' : 'text'}
                                  placeholder={field.placeholder}
                                  value={formValues[field.key] ?? ''}
                                  onChange={(e) => setFormValues((v) => ({ ...v, [field.key]: e.target.value }))}
                                  className="w-full border border-input rounded-md px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                                  required={!field.label.includes('optional')}
                                />
                                {isPassword && (
                                  <button
                                    type="button"
                                    onClick={() => setRevealedFields((v) => ({ ...v, [field.key]: !isRevealed }))}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                  >
                                    {isRevealed ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                        <div className="flex gap-3 pt-1">
                          <button
                            type="submit"
                            disabled={createMutation.isPending}
                            className="flex-1 bg-primary text-primary-foreground rounded-md py-2 text-sm font-medium disabled:opacity-50"
                          >
                            {createMutation.isPending ? 'Connecting...' : 'Save & Test'}
                          </button>
                          <button
                            type="button"
                            onClick={closeDrawer}
                            className="px-4 py-2 border border-border rounded-md text-sm"
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    )}

                    {/* Setup guide — always open for webhook platforms, collapsible for others */}
                    <div className="border border-border rounded-lg overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setShowGuide(showGuide === connectingPlatform ? null : connectingPlatform)}
                        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/40 transition-colors text-left"
                      >
                        <span>{activePlatform.fields.length === 0 ? 'Setup instructions' : 'Where do I find these credentials?'}</span>
                        <span className="text-muted-foreground text-xs">{showGuide === connectingPlatform ? '▲ Hide' : '▼ Show'}</span>
                      </button>
                      <AnimatePresence>
                        {showGuide === connectingPlatform && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="px-4 pb-4 border-t border-border bg-muted/20">
                              <p className="text-xs font-semibold mt-3 mb-2 text-foreground">{activePlatform.guide.title}</p>
                              <ol className="space-y-1.5">
                                {activePlatform.guide.steps.map((step, i) => (
                                  <li key={i} className="flex gap-2 text-xs text-muted-foreground">
                                    <span className="shrink-0 w-4 h-4 rounded-full bg-primary/10 text-primary text-[10px] flex items-center justify-center font-bold">{i + 1}</span>
                                    <span>{step}</span>
                                  </li>
                                ))}
                              </ol>
                              {activePlatform.guide.docsUrl && (
                                <a
                                  href={activePlatform.guide.docsUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-3"
                                >
                                  <ExternalLink className="w-3 h-3" /> View official docs
                                </a>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
