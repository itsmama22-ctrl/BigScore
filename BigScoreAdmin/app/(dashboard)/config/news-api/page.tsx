 "use client";

 import { useEffect, useState, useCallback } from "react";
 import { queryWithFallback } from "@/lib/queryWithFallback";
 import { db } from "@/lib/firebase/client";
 import { useAuth } from "@/hooks/useAuth";
 import { saveNewsApiConfigAction, testNewsApiConnectionAction } from "@/app/actions/newsApi";
 import { Button } from "@/components/ui/button";
 import { Input } from "@/components/ui/input";
 import { Switch } from "@/components/ui/switch";
 import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
 import { Badge } from "@/components/ui/badge";
 import { cn } from "@/lib/utils";
 import type { NewsApiProviderConfig } from "@/models/newsArticle";
 import { Save, Loader2, CheckCircle2, AlertCircle, Plus, Trash2, Wifi, RefreshCw, Clock, Database } from "lucide-react";

 interface SyncStatus {
   lastSyncAt: { seconds: number } | null;
   lastSyncStatus: string;
   lastSyncResult?: {
     created: number;
     updated: number;
     errors?: string[];
   } | null;
 }

const defaultProvider: NewsApiProviderConfig = {
  id: "",
  name: "",
  providerType: "mock",
  endpointUrl: "",
  apiKeySecretName: "",
  apiKeyMasked: "",
  enabled: true,
  categoryMapping: {},
  fetchIntervalMinutes: 360,
};

const PROVIDER_TYPES = [
  { value: "newsdata_io", label: "NewsData.io", description: "Strict football news API (free tier: 100 req/day)" },
  { value: "mock", label: "Mock Provider", description: "For testing only - returns dummy data" },
  { value: "custom", label: "Custom (advanced)", description: "For future providers - uses name-based detection" },
] as const;

function newProvider(): NewsApiProviderConfig {
  return { ...defaultProvider, id: `api-${Date.now()}` };
}

 export default function NewsApiConfigPage() {
   const { adminProfile } = useAuth();
   const [apis, setApis] = useState<NewsApiProviderConfig[]>([newProvider()]);
   const [loading, setLoading] = useState(true);
   const [saving, setSaving] = useState(false);
   const [testing, setTesting] = useState<Record<string, boolean>>({});
   const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);
   const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
   const [syncing, setSyncing] = useState(false);
   const [syncStatusLoading, setSyncStatusLoading] = useState(false);

    const loadSyncStatus = useCallback(async () => {
      setSyncStatusLoading(true);
      try {
        const result = await queryWithFallback({ collection: "appSettings", docId: "newsApi" });
        if (result.length > 0) {
          const d = result[0] as { lastSyncAt?: { seconds: number }; lastSyncStatus?: string; lastSyncResult?: { created?: number; updated?: number; errors?: string[] } };
          setSyncStatus({
            lastSyncAt: d.lastSyncAt ?? null,
            lastSyncStatus: d.lastSyncStatus ?? "never",
            lastSyncResult: (d.lastSyncResult ?? null) as { created: number; updated: number; errors?: string[] } | null,
          });
        }
      } catch { /* */ } finally {
        setSyncStatusLoading(false);
      }
    }, []);

    const loadConfig = useCallback(async () => {
      setLoading(true);
      try {
        const result = await queryWithFallback({ collection: "appSettings", docId: "newsApi" });
        if (result.length > 0) {
          const data = result[0] as { apis?: NewsApiProviderConfig[] };
          if (Array.isArray(data.apis) && data.apis.length > 0) {
            setApis(data.apis);
          }
        }
      } catch { /* */ } finally { setLoading(false); }
    }, []);

   async function handleSyncNow() {
     if (!adminProfile) return;
     setSyncing(true);
     try {
       const res = await fetch("/api/news-sync?sync=1", {
         method: "GET",
         headers: {
           "x-vercel-cron": "1",
         },
       });
       const result = await res.json();
       
       if (result.success || result.created > 0 || result.updated > 0) {
         setToast({
           type: "success",
           message: `Sync complete: ${result.created || 0} created, ${result.updated || 0} updated`,
         });
         loadSyncStatus();
       } else {
         setToast({
           type: "error",
           message: result.error || "Sync failed",
         });
       }
     } catch {
       setToast({ type: "error", message: "Sync request failed" });
     } finally {
       setSyncing(false);
     }
   }

   useEffect(() => { loadConfig(); loadSyncStatus(); }, [loadConfig, loadSyncStatus]);
   useEffect(() => {
     if (toast) { const t = setTimeout(() => setToast(null), 4000); return () => clearTimeout(t); }
   }, [toast]);

  function updateApi(id: string, patch: Partial<NewsApiProviderConfig>) {
    setApis((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  }

  function removeApi(id: string) {
    setApis((prev) => prev.filter((a) => a.id !== id));
  }

  async function handleSave() {
    if (!adminProfile) return;
    setSaving(true);
    const result = await saveNewsApiConfigAction({
      apis,
      actor: { uid: adminProfile.uid, email: adminProfile.email, role: adminProfile.role },
    });
    setSaving(false);
    setToast(result.success ? { type: "success", message: "Settings saved." } : { type: "error", message: result.error ?? "Failed." });
    if (result.success) loadConfig();
  }

  async function handleTestConnection(api: NewsApiProviderConfig) {
    if (!adminProfile) return;
    setTesting((p) => ({ ...p, [api.id]: true }));
    const raw = await testNewsApiConnectionAction({ config: api, actor: { uid: adminProfile.uid, email: adminProfile.email, role: adminProfile.role } });
    const result = raw as unknown as { success: boolean; message?: string; error?: string };
    setTesting((p) => ({ ...p, [api.id]: false }));
    setToast(result.success ? { type: "success", message: result.message ?? "Connected." } : { type: "error", message: result.error ?? "Failed." });
  }

  if (loading) return <div className="flex flex-col gap-6">{Array.from({ length: 2 }).map((_, i) => <div key={i} className="h-40 animate-pulse rounded-lg bg-bg-secondary" />)}</div>;

  return (
    <div className="flex flex-col gap-6">
      <div><h1 className="text-h2 text-text-primary">News API Configuration</h1><p className="text-body text-text-tertiary">Configure external news feed providers for automatic article syncing</p></div>

       {toast && (
         <div className={cn("flex items-center gap-3 rounded-lg border px-4 py-3", toast.type === "success" ? "border-accent-green/30 bg-accent-green/10" : "border-accent-red/30 bg-accent-red/10")}>
           {toast.type === "success" ? <CheckCircle2 className="h-5 w-5 shrink-0 text-accent-green" /> : <AlertCircle className="h-5 w-5 shrink-0 text-accent-red" />}
           <p className="text-body text-text-primary flex-1">{toast.message}</p>
         </div>
       )}

       <Card>
         <CardHeader className="pb-3">
           <div className="flex items-center justify-between">
             <div className="flex items-center gap-2">
               <RefreshCw className="h-5 w-5 text-accent-blue" />
               <CardTitle>Auto-Sync Status</CardTitle>
             </div>
             <Button variant="outline" size="sm" onClick={handleSyncNow} disabled={syncing || syncStatusLoading}>
               {syncing && <Loader2 className="h-4 w-4 animate-spin" />}
               {!syncing && <RefreshCw className="h-4 w-4" />}
               Sync Now
             </Button>
           </div>
         </CardHeader>
         <CardContent>
           {syncStatusLoading ? (
             <div className="flex items-center gap-2 text-body text-text-tertiary">
               <Loader2 className="h-4 w-4 animate-spin" />
               Loading status...
             </div>
           ) : syncStatus?.lastSyncAt ? (
             <div className="flex flex-col gap-3">
               <div className="flex flex-wrap items-center gap-4">
                 <div className="flex items-center gap-2">
                   <Clock className="h-4 w-4 text-text-tertiary" />
                   <span className="text-body-sm text-text-secondary">
                     Last sync: <span className="text-text-primary">{new Date(syncStatus.lastSyncAt.seconds * 1000).toLocaleString()}</span>
                   </span>
                 </div>
                 <Badge variant={syncStatus.lastSyncStatus === "success" ? "green" : syncStatus.lastSyncStatus === "partial" ? "gold" : "draft"}>
                   {syncStatus.lastSyncStatus === "success" ? "Success" : syncStatus.lastSyncStatus === "partial" ? "Partial" : syncStatus.lastSyncStatus}
                 </Badge>
               </div>
               {syncStatus.lastSyncResult && (
                 <div className="flex flex-wrap items-center gap-4 text-body-sm">
                   <div className="flex items-center gap-1.5">
                     <Database className="h-4 w-4 text-accent-green" />
                     <span className="text-text-secondary">
                       <span className="text-text-primary font-medium">{syncStatus.lastSyncResult.created}</span> articles created
                     </span>
                   </div>
                   <div className="flex items-center gap-1.5">
                     <RefreshCw className="h-4 w-4 text-accent-blue" />
                     <span className="text-text-secondary">
                       <span className="text-text-primary font-medium">{syncStatus.lastSyncResult.updated}</span> articles updated
                     </span>
                   </div>
                   {syncStatus.lastSyncResult.errors && syncStatus.lastSyncResult.errors.length > 0 && (
                     <div className="flex items-center gap-1.5">
                       <AlertCircle className="h-4 w-4 text-accent-red" />
                       <span className="text-accent-red">
                         {syncStatus.lastSyncResult.errors.length} error(s)
                       </span>
                     </div>
                   )}
                 </div>
               )}
             </div>
           ) : (
             <div className="flex items-center gap-2 text-body text-text-tertiary">
               <Clock className="h-4 w-4" />
                <span>No syncs yet. Click &ldquo;Sync Now&rdquo; to test, or deploy to Vercel for automatic sync every 6 hours.</span>
             </div>
           )}
           <p className="mt-3 text-caption text-text-disabled">
             Auto-sync runs every 6 hours on Vercel and saves articles automatically. Free tier: 4 requests/day (well under 100 limit).
           </p>
         </CardContent>
       </Card>

       {apis.map((api) => (
        <Card key={api.id}>
          <CardHeader className="flex flex-row items-start justify-between">
            <div>
              <CardTitle>{api.name || "New Provider"}</CardTitle>
              <div className="mt-1 flex items-center gap-2">
                <Badge variant={api.enabled ? "green" : "disabled"}>{api.enabled ? "Enabled" : "Disabled"}</Badge>
                {api.apiKeyMasked && <span className="text-caption text-text-disabled font-mono">{api.apiKeyMasked}</span>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={api.enabled} onCheckedChange={(v) => updateApi(api.id, { enabled: v })} aria-label="Enable provider" />
              <button onClick={() => removeApi(api.id)} className="rounded-md p-1.5 text-text-tertiary hover:bg-bg-tertiary hover:text-accent-red"><Trash2 className="h-4 w-4" /></button>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="block text-caption font-medium text-text-secondary mb-1">
                  Provider Type
                </label>
                <select
                  value={api.providerType}
                  onChange={(e) => {
                    const type = e.target.value as NewsApiProviderConfig["providerType"];
                    updateApi(api.id, {
                      providerType: type,
                      name: type === "newsdata_io" ? (api.name || "NewsData.io") : api.name,
                      apiKeySecretName: type === "newsdata_io" ? (api.apiKeySecretName || "NEWSDATA_IO_API_KEY") : api.apiKeySecretName,
                      fetchIntervalMinutes: type === "newsdata_io" ? 360 : api.fetchIntervalMinutes,
                    });
                  }}
                  className="w-full rounded-lg border border-border-default bg-bg-tertiary px-3 py-2.5 text-body text-text-primary focus:border-border-focus focus:outline-none"
                >
                  {PROVIDER_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label} — {t.description}
                    </option>
                  ))}
                </select>
              </div>
              <Input label="Provider Name" placeholder="e.g. NewsData.io" value={api.name} onChange={(e) => updateApi(api.id, { name: e.target.value })} />
              <Input label="Endpoint URL" type="url" placeholder="Leave empty for default" value={api.endpointUrl} onChange={(e) => updateApi(api.id, { endpointUrl: e.target.value })} />
              <Input label="API Key Env Variable" placeholder="e.g. NEWSDATA_IO_API_KEY" value={api.apiKeySecretName} onChange={(e) => updateApi(api.id, { apiKeySecretName: e.target.value, apiKeyMasked: e.target.value ? `env:${e.target.value}` : "" })} helperText="Reference to a Vercel env var. Never stores the actual key." />
              <Input label="Fetch Interval (minutes)" type="number" min={1} value={api.fetchIntervalMinutes} onChange={(e) => updateApi(api.id, { fetchIntervalMinutes: parseInt(e.target.value) || 60 })} helperText={api.fetchIntervalMinutes >= 360 ? "Good — stays well under 100 req/day limit" : api.fetchIntervalMinutes >= 144 ? "OK — about 100 req/day" : "⚠️ May exceed free tier 100 req/day limit"} />
            </div>
            <div className="flex gap-3">
              <Button variant="outline" size="sm" onClick={() => handleTestConnection(api)} disabled={testing[api.id]}>
                {testing[api.id] && <Loader2 className="h-4 w-4 animate-spin" />}<Wifi className="h-4 w-4" />Test Connection
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}

      <div className="flex items-center gap-3">
        <Button variant="outline" onClick={() => setApis((p) => [...p, newProvider()])}><Plus className="h-4 w-4" />Add Provider</Button>
        <Button variant="primary" size="lg" onClick={handleSave} disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin" />}<Save className="h-4 w-4" />Save Configuration</Button>
      </div>
    </div>
  );
}
