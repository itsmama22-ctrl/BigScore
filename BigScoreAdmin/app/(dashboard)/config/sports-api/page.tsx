"use client";

import { useEffect, useState } from "react";
import { doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { queryWithFallback } from "@/lib/queryWithFallback";
import { useAuth } from "@/hooks/useAuth";
import { testProviderConnectionAction } from "@/app/actions/syncManagement";
import { availableProviders } from "@/lib/services/providers/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Loader2, CheckCircle2, AlertCircle, Wifi, Shield, PlugZap, Save } from "lucide-react";

type ProviderConfig = { apiKeyEnvName: string; enabled: boolean };

export default function SportsApiConfigPage() {
  const { adminProfile } = useAuth();
  const [providerConfigs, setProviderConfigs] = useState<Record<string, ProviderConfig>>({});
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState<Record<string, boolean>>({});
  const [results, setResults] = useState<Record<string, { success: boolean; message: string } | null>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  useEffect(() => {
    async function load() {
      const result = await queryWithFallback({ collection: "appSettings", docId: "sportsApi" });
      if (result.length > 0) {
        const data = result[0] as { providers?: Record<string, ProviderConfig> };
        if (data.providers) setProviderConfigs(data.providers);
      }
      setLoading(false);
    }
    load();
  }, []);

  function getConfig(providerId: string): ProviderConfig {
    return providerConfigs[providerId] || { apiKeyEnvName: "", enabled: false };
  }

  function updateConfig(providerId: string, updates: Partial<ProviderConfig>) {
    setProviderConfigs((prev) => ({
      ...prev,
      [providerId]: { ...getConfig(providerId), ...updates },
    }));
  }

  async function saveConfig(providerId: string) {
    if (!adminProfile) return;
    setSaving((p) => ({ ...p, [providerId]: true }));
    const config = getConfig(providerId);
    try {
      await setDoc(doc(db, "appSettings", "sportsApi"), {
        providers: { ...providerConfigs, [providerId]: config },
      }, { merge: true });
    } catch {
      // silently fail save
    }
    setSaving((p) => ({ ...p, [providerId]: false }));
  }

  async function testConnection(providerId: string) {
    if (!adminProfile) return;
    const config = getConfig(providerId);
    setTesting((p) => ({ ...p, [providerId]: true }));
    const raw = await testProviderConnectionAction({
      providerId,
      apiKeyEnvName: config.apiKeyEnvName || "",
      actor: { uid: adminProfile.uid, email: adminProfile.email, role: adminProfile.role },
    });
    const r = raw as unknown as { success: boolean; message?: string; error?: string };
    setTesting((p) => ({ ...p, [providerId]: false }));
    setResults((p) => ({
      ...p,
      [providerId]: r.success
        ? { success: true, message: r.message ?? "" }
        : { success: false, message: r.error ?? "" },
    }));
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-32 animate-pulse rounded-lg bg-bg-secondary" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-h2 text-text-primary">Sports API Providers</h1>
        <p className="text-body text-text-tertiary">Manage external sports data provider integrations</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {availableProviders.map((p) => {
          const config = getConfig(p.id);
          const res = results[p.id];
          const isTest = testing[p.id];
          const isSave = saving[p.id];
          const isEnabled = config.enabled || p.id === "mock";

          return (
            <Card key={p.id}>
              <CardHeader className="flex flex-row items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <PlugZap className="h-5 w-5 text-accent-blue" />
                    <CardTitle>{p.name}</CardTitle>
                  </div>
                  <p className="mt-1 text-caption text-text-disabled font-mono">ID: {p.id}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      updateConfig(p.id, { enabled: !config.enabled });
                      saveConfig(p.id);
                    }}
                  >
                    <Badge variant={isEnabled ? "green" : "disabled"}>
                      {isEnabled ? "Active" : "Inactive"}
                    </Badge>
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {p.needsApiKey && (
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <Input
                        label="API Key Env Variable"
                        value={config.apiKeyEnvName}
                        onChange={(e) => updateConfig(p.id, { apiKeyEnvName: e.target.value })}
                        onBlur={() => saveConfig(p.id)}
                        onKeyDown={(e) => { if (e.key === "Enter") saveConfig(p.id); }}
                        placeholder="e.g. API_FOOTBALL_KEY"
                        helperText="Set via Vercel Environment Variables or .env.local. The value here is the variable name, not the key."
                      />
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => saveConfig(p.id)}
                      disabled={isSave}
                      className="mb-0.5 shrink-0"
                    >
                      {isSave ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    </Button>
                  </div>
                )}

                {!p.needsApiKey && (
                  <p className="text-body-sm text-text-tertiary">
                    No API key required — this provider is publicly accessible.
                  </p>
                )}

                <div className="flex items-center gap-2 text-body-sm text-text-tertiary">
                  <Shield className="h-4 w-4" />
                  <span>
                    Daily limit:{" "}
                    {p.id === "mock" || p.id === "openligadb"
                      ? "∞"
                      : p.id === "api-football"
                        ? "100"
                        : "1440"}{" "}
                    requests
                  </span>
                </div>

                {res && (
                  <div
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-3 py-2 text-body-sm",
                      res.success ? "bg-accent-green/10 text-accent-green" : "bg-accent-red/10 text-accent-red"
                    )}
                  >
                    {res.success ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                    {res.message}
                  </div>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => testConnection(p.id)}
                  disabled={isTest || (p.needsApiKey && !config.apiKeyEnvName)}
                >
                  {isTest && <Loader2 className="h-4 w-4 animate-spin" />}
                  <Wifi className="h-4 w-4" /> Test Connection
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
