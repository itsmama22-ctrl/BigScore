"use client";

import { useEffect, useState, useCallback } from "react";
import { queryWithFallback } from "@/lib/queryWithFallback";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/hooks/useAuth";
import { saveLiveMatchSettingsAction, testApiConnectionAction } from "@/app/actions/liveMatchSettings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { LiveMatchSettingsFormValues } from "@/lib/validation/liveMatchSettingsSchema";
import {
  Save, Loader2, CheckCircle2, AlertCircle, Radio, Settings, Wifi,
  Clock, RefreshCw, Shield, PlugZap,
} from "lucide-react";

const defaults: LiveMatchSettingsFormValues = {
  liveMatchesSourceMode: "manual",
  enableLiveWatchButton: true,
  livePageStadiumMode: true,
  showApiSyncedBadge: false,
  apiProviderName: "",
  apiBaseUrl: "",
  apiKeySecretName: "",
  syncIntervalMinutes: 60,
  autoPublishApiMatches: false,
  allowedCompetitions: [],
};

function formatTimestamp(ts?: { seconds: number }): string {
  if (!ts) return "--";
  return new Date(ts.seconds * 1000).toLocaleString();
}

export default function LiveMatchSettingsPage() {
  const { adminProfile } = useAuth();
  const [settings, setSettings] = useState<LiveMatchSettingsFormValues & { apiKeyMasked?: string; lastSyncAt?: { seconds: number }; lastSyncStatus?: string; lastSyncError?: string }>(defaults);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const data = await queryWithFallback({ collection: "appSettings", docId: "liveMatches" });
      if (data.length > 0) {
        setSettings({ ...defaults, ...data[0] as Record<string, unknown> } as never);
      }
    } catch { /* */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadSettings(); }, [loadSettings]);
  useEffect(() => {
    if (toast) { const t = setTimeout(() => setToast(null), 4000); return () => clearTimeout(t); }
  }, [toast]);

  const update = <K extends keyof typeof settings>(k: K, v: (typeof settings)[K]) => setSettings((p) => ({ ...p, [k]: v }));

  async function handleSave() {
    if (!adminProfile) return;
    setSaving(true);
    const cleanSettings: LiveMatchSettingsFormValues = {
      liveMatchesSourceMode: settings.liveMatchesSourceMode,
      enableLiveWatchButton: settings.enableLiveWatchButton,
      livePageStadiumMode: settings.livePageStadiumMode,
      showApiSyncedBadge: settings.showApiSyncedBadge,
      apiProviderName: settings.apiProviderName,
      apiBaseUrl: settings.apiBaseUrl,
      apiKeySecretName: settings.apiKeySecretName,
      syncIntervalMinutes: settings.syncIntervalMinutes,
      autoPublishApiMatches: settings.autoPublishApiMatches,
      allowedCompetitions: settings.allowedCompetitions ?? [],
    };
    const result = await saveLiveMatchSettingsAction({ settings: cleanSettings, actor: { uid: adminProfile.uid, email: adminProfile.email, role: adminProfile.role } });
    setSaving(false);
    setToast(result.success ? { type: "success", message: "Settings saved." } : { type: "error", message: result.error ?? "Failed." });
    if (result.success) loadSettings();
  }

  async function handleTestConnection() {
    if (!adminProfile) return;
    setTesting(true);
    const raw = await testApiConnectionAction({ actor: { uid: adminProfile.uid, email: adminProfile.email, role: adminProfile.role } });
    const result = raw as unknown as { success: boolean; message?: string; error?: string };
    setTesting(false);
    setToast(result.success ? { type: "success", message: (result.message as string) ?? "Connection successful." } : { type: "error", message: (result.error as string) ?? "Connection failed." });
  }

  async function handleRunSync() {
    if (!adminProfile) return;
    setSyncing(true);
    try {
      const token = await import("firebase/auth").then((m) => {
        const { getAuth } = m;
        return getAuth().currentUser?.getIdToken();
      });
      const res = await fetch("/api/live-sync", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setToast(data.success ? { type: "success", message: `Sync done: ${data.created} created, ${data.updated} updated.` } : { type: "error", message: data.error ?? "Sync failed." });
    } catch { setToast({ type: "error", message: "Sync request failed." }); }
    finally { setSyncing(false); loadSettings(); }
  }

  if (loading) return <div className="flex flex-col gap-6">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-40 animate-pulse rounded-lg bg-bg-secondary" />)}</div>;

  return (
    <div className="flex flex-col gap-6">
      <div><h1 className="text-h2 text-text-primary">Live Match Settings</h1><p className="text-body text-text-tertiary">Configure how live matches are sourced and displayed</p></div>

      {toast && (
        <div className={cn("flex items-center gap-3 rounded-lg border px-4 py-3", toast.type === "success" ? "border-accent-green/30 bg-accent-green/10" : "border-accent-red/30 bg-accent-red/10")}>
          {toast.type === "success" ? <CheckCircle2 className="h-5 w-5 shrink-0 text-accent-green" /> : <AlertCircle className="h-5 w-5 shrink-0 text-accent-red" />}
          <p className="text-body text-text-primary flex-1">{toast.message}</p>
        </div>
      )}

      {/* Match Source */}
      <Card>
        <CardHeader><div className="flex items-center gap-2"><Radio className="h-5 w-5 text-accent-gold" /><CardTitle>Match Source</CardTitle></div></CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div>
            <label className="mb-1.5 block text-label text-text-secondary">Source Mode</label>
            <div className="flex gap-2">
              {(["manual", "api", "hybrid"] as const).map((m) => (
                <button key={m} type="button" onClick={() => update("liveMatchesSourceMode", m)}
                  className={cn("rounded-lg px-4 py-2 text-body-sm font-medium capitalize transition-colors", settings.liveMatchesSourceMode === m ? "bg-accent-gold text-button-primary-text" : "bg-bg-tertiary text-text-secondary hover:text-text-primary")}>
                  {m}
                </button>
              ))}
            </div>
            <p className="mt-1 text-caption text-text-disabled">Manual: admin creates matches. API: external sync. Hybrid: API fills data, admin can override.</p>
          </div>
          <Switch checked={settings.autoPublishApiMatches} onCheckedChange={(v) => update("autoPublishApiMatches", v)} label="Auto-publish API matches" description="Matches from the API are published immediately without manual review." />
          <Switch checked={settings.showApiSyncedBadge} onCheckedChange={(v) => update("showApiSyncedBadge", v)} label='Show "Synced from API" badge' description="Display a badge on API-sourced matches in the admin panel and iOS app." />
        </CardContent>
      </Card>

      {/* API Provider */}
      {(settings.liveMatchesSourceMode === "api" || settings.liveMatchesSourceMode === "hybrid") && (
        <Card>
          <CardHeader><div className="flex items-center gap-2"><PlugZap className="h-5 w-5 text-accent-blue" /><CardTitle>API Provider</CardTitle></div></CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Input label="Provider Name" placeholder="e.g. Sportmonks" value={settings.apiProviderName ?? ""} onChange={(e) => update("apiProviderName", e.target.value)} />
            <Input label="API Base URL" type="url" placeholder="https://api.example.com/v1" value={settings.apiBaseUrl ?? ""} onChange={(e) => update("apiBaseUrl", e.target.value)} />
            <Input label="API Key Env Variable" placeholder="e.g. SPORTMONKS_API_KEY" value={settings.apiKeySecretName ?? ""} onChange={(e) => update("apiKeySecretName", e.target.value)}
              helperText="Store the actual key in Vercel Environment Variables. This field references the env var name only." />
            {settings.apiKeyMasked && <p className="text-caption text-text-disabled">Current key reference: <code className="rounded bg-bg-tertiary px-1 py-0.5">{settings.apiKeyMasked}</code> (never exposed)</p>}
            <Input label="Sync Interval (minutes)" type="number" min={1} value={settings.syncIntervalMinutes} onChange={(e) => update("syncIntervalMinutes", parseInt(e.target.value) || 60)} />
            <div className="flex gap-3">
              <Button variant="outline" size="sm" onClick={handleTestConnection} disabled={testing}>{testing && <Loader2 className="h-4 w-4 animate-spin" />}<Wifi className="h-4 w-4" />Test Connection</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Watch Button */}
      <Card>
        <CardHeader><div className="flex items-center gap-2"><Settings className="h-5 w-5 text-accent-green" /><CardTitle>Watch Button Behavior</CardTitle></div></CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Switch checked={settings.enableLiveWatchButton} onCheckedChange={(v) => update("enableLiveWatchButton", v)} label="Enable Global Watch Button" description="Master switch for the 'Tap to Watch' feature. Per-match watch mode still requires this to be on." />
          <Switch checked={settings.livePageStadiumMode} onCheckedChange={(v) => update("livePageStadiumMode", v)} label="Show Stadium/Venue Text" description="When watch mode is disabled, the iOS app displays stadium or venue text instead." />
        </CardContent>
      </Card>

      {/* Sync Status */}
      <Card>
        <CardHeader><div className="flex items-center gap-2"><RefreshCw className="h-5 w-5 text-accent-orange" /><CardTitle>Sync Status</CardTitle></div></CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="text-body-sm text-text-tertiary">Last sync:</span>
                <span className="flex items-center gap-1.5 text-body-sm text-text-secondary"><Clock className="h-3.5 w-3.5" />{formatTimestamp(settings.lastSyncAt)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-body-sm text-text-tertiary">Status:</span>
                <Badge variant={settings.lastSyncStatus === "success" ? "green" : settings.lastSyncStatus === "failed" ? "red" : "draft"}>{settings.lastSyncStatus ?? "never"}</Badge>
              </div>
              {settings.lastSyncError && <p className="text-caption text-accent-red max-w-md">{settings.lastSyncError}</p>}
            </div>
            <Button variant="primary" size="sm" onClick={handleRunSync} disabled={syncing}>
              {syncing && <Loader2 className="h-4 w-4 animate-spin" />}<RefreshCw className="h-4 w-4" />Run Sync Now
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Save */}
      <Card><CardContent className="flex items-center justify-between p-4">
        <p className="text-body-sm text-text-tertiary"><Shield className="inline h-4 w-4 mr-1" />Super admin only. Changes are audit logged.</p>
        <Button variant="primary" size="lg" onClick={handleSave} disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin" />}<Save className="h-4 w-4" />Save Settings</Button>
      </CardContent></Card>
    </div>
  );
}
