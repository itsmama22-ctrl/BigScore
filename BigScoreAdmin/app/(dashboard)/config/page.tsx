"use client";

import { useEffect, useState, useCallback } from "react";
import { queryWithFallback } from "@/lib/queryWithFallback";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  updateAppConfigAction,
  type AppSettingsData,
  type LiveTabMode,
} from "@/app/actions/config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  Save,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Settings,
  Flag,
  ShieldAlert,
  Smartphone,
  Clock,
  User,
} from "lucide-react";

const defaultSettings: AppSettingsData = {
  enableSportPackages: true,
  liveTabMode: "live_matches",
  enableMoviesSeries: true,
  enableLiveWatchButton: true,
  enableAdMob: false,
  enableAppOpenAds: false,
  enableInterstitialAds: false,
  enableNews: true,
  enablePushNotifications: true,
  showTeamLogos: true,
  maintenanceMode: false,
  maintenanceMessage: "",
  minimumSupportedVersion: "1.0.0",
  forceUpdateEnabled: false,
};

interface ConfigState extends AppSettingsData {
  updatedAt?: { seconds: number };
  updatedByEmail?: string;
}

function formatTimestamp(seconds?: number): string {
  if (!seconds) return "Never";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(seconds * 1000));
}

export default function ConfigPage() {
  const { adminProfile } = useAuth();

  const [settings, setSettings] = useState<ConfigState>(defaultSettings);
  const [originalSettings, setOriginalSettings] = useState<ConfigState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const [lastSaved, setLastSaved] = useState<{
    updatedAt?: { seconds: number };
    updatedByEmail?: string;
  }>({});

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const loadConfig = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    try {
      const result = await queryWithFallback({ collection: "appSettings", docId: "config" });
      if (result.length > 0) {
        const data = result[0] as Record<string, unknown>;
        const merged = { ...defaultSettings };

        for (const key of Object.keys(defaultSettings)) {
          if (key in data) {
            (merged as Record<string, unknown>)[key] = data[key];
          }
        }

        setSettings(merged);
        setOriginalSettings({ ...merged });
        setLastSaved({
          updatedAt: data.updatedAt as { seconds: number } | undefined,
          updatedByEmail: data.updatedByEmail as string | undefined,
        });
      } else {
        setSettings(defaultSettings);
        setLastSaved({});
      }
    } catch (err) {
      console.error("[config]", err);
      setLoadError("Failed to load configuration.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  function updateField<K extends keyof AppSettingsData>(
    key: K,
    value: AppSettingsData[K]
  ) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    if (!adminProfile) return;

    setSaving(true);
    setToast(null);

    try {
      const result = await updateAppConfigAction({
        settings,
        actorUid: adminProfile.uid,
        actorEmail: adminProfile.email,
        actorRole: adminProfile.role,
      });

      if (result.success) {
        setLastSaved({
          updatedAt: { seconds: Math.floor(Date.now() / 1000) },
          updatedByEmail: adminProfile.email,
        });
        setToast({ type: "success", message: "Configuration saved successfully." });
      } else {
        setToast({
          type: "error",
          message: result.error ?? "Failed to save configuration.",
        });
      }
    } catch {
      setToast({ type: "error", message: "An unexpected error occurred." });
    } finally {
      setSaving(false);
    }
  }

  function hasChanges(): boolean {
    return (
      JSON.stringify({
        ...settings,
        updatedAt: undefined,
        updatedByEmail: undefined,
      }) !==
      JSON.stringify({
        ...defaultSettings,
        ...originalSettings,
        updatedAt: undefined,
        updatedByEmail: undefined,
      })
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-h2 text-text-primary">App Configuration</h1>
          <p className="text-body text-text-tertiary">
            Manage global app settings and feature flags
          </p>
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="flex flex-col gap-4 p-6">
              <div className="h-5 w-40 animate-pulse rounded bg-bg-tertiary" />
              <div className="h-4 w-full animate-pulse rounded bg-bg-tertiary" />
              <div className="h-4 w-3/4 animate-pulse rounded bg-bg-tertiary" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-h2 text-text-primary">App Configuration</h1>
        <Card className="border-border-error">
          <CardContent className="flex items-center justify-between p-4">
            <p className="text-body text-accent-red">{loadError}</p>
            <Button variant="ghost" size="sm" onClick={loadConfig}>
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const switchField = (
    key: keyof AppSettingsData,
    label: string,
    description: string
  ) => (
    <Switch
      checked={settings[key] as boolean}
      onCheckedChange={(v) => updateField(key, v as AppSettingsData[typeof key])}
      label={label}
      description={description}
    />
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-h2 text-text-primary">App Configuration</h1>
          <p className="text-body text-text-tertiary">
            Manage global app settings and feature flags
          </p>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={cn(
            "flex items-center gap-3 rounded-lg border px-4 py-3",
            toast.type === "success"
              ? "border-accent-green/30 bg-accent-green/10"
              : "border-accent-red/30 bg-accent-red/10"
          )}
        >
          {toast.type === "success" ? (
            <CheckCircle2 className="h-5 w-5 shrink-0 text-accent-green" />
          ) : (
            <AlertCircle className="h-5 w-5 shrink-0 text-accent-red" />
          )}
          <p className="text-body text-text-primary flex-1">{toast.message}</p>
        </div>
      )}

      {/* Feature Flags */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Flag className="h-5 w-5 text-accent-gold" />
            <CardTitle>Feature Flags</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          {switchField(
            "enableMoviesSeries",
            "Movies & Series",
            "Show the Movies & Series section in the iOS app."
          )}
          <div className="flex flex-col gap-3">
            {switchField(
              "enableSportPackages",
              "Sport Packages",
              "Enable sport streaming packages with live channels."
            )}
            {settings.enableSportPackages && (
              <div className="ml-10 flex flex-col gap-2">
                <label className="text-body-sm font-medium text-text-primary">
                  LIVE Tab Default Mode
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => updateField("liveTabMode", "live_tv" as LiveTabMode)}
                    className={cn(
                      "flex-1 rounded-lg px-4 py-2 text-body-sm font-medium transition-colors",
                      settings.liveTabMode === "live_tv" || settings.liveTabMode === "live_matches"
                        ? "bg-accent-gold text-white"
                        : "bg-bg-tertiary text-text-secondary hover:bg-bg-secondary"
                    )}
                  >
                    Live TV
                  </button>
                  <button
                    type="button"
                    onClick={() => updateField("liveTabMode", "packages" as LiveTabMode)}
                    className={cn(
                      "flex-1 rounded-lg px-4 py-2 text-body-sm font-medium transition-colors",
                      settings.liveTabMode === "packages"
                        ? "bg-accent-gold text-white"
                        : "bg-bg-tertiary text-text-secondary hover:bg-bg-secondary"
                    )}
                  >
                    Packages
                  </button>
                </div>
                <p className="text-caption text-text-tertiary">
                  Choose which content appears in the iOS app LIVE tab.
                </p>
              </div>
            )}
          </div>
          {switchField(
            "enableLiveWatchButton",
            "Live Watch Button",
            'Show the "Tap to Watch" button on live match screens.'
          )}
          {switchField(
            "enableNews",
            "News",
            "Show the News section in the iOS app."
          )}
          {switchField(
            "enablePushNotifications",
            "Push Notifications",
            "Allow sending push notifications to iOS app users."
          )}
          {switchField(
            "showTeamLogos",
            "Team & Competition Logos",
            "Show team and competition logos. When disabled, initials and country codes are shown instead."
          )}
        </CardContent>
      </Card>

      {/* AdMob Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-accent-blue" />
            <CardTitle>AdMob Configuration</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          {switchField(
            "enableAdMob",
            "Enable AdMob",
            "Show advertisements in the iOS app."
          )}
          {switchField(
            "enableAppOpenAds",
            "App Open Ads",
            "Show ads when the app opens."
          )}
          {switchField(
            "enableInterstitialAds",
            "Interstitial Ads",
            "Show full-screen ads between navigations."
          )}
        </CardContent>
      </Card>

      {/* Maintenance */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-accent-orange" />
            <CardTitle>Maintenance</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          {switchField(
            "maintenanceMode",
            "Maintenance Mode",
            "Display a maintenance screen to all app users. Super admins in the admin panel are unaffected."
          )}

          <div className="max-w-lg">
            <label className="mb-1.5 block text-label text-text-secondary">
              Maintenance Message
            </label>
            <textarea
              value={settings.maintenanceMessage ?? ""}
              onChange={(e) => updateField("maintenanceMessage", e.target.value)}
              rows={3}
              maxLength={200}
              placeholder="We're currently performing scheduled maintenance. Please check back soon."
              className="w-full resize-none rounded-lg border border-border-default bg-bg-tertiary px-4 py-2.5 text-body text-text-primary placeholder:text-text-disabled focus:border-border-focus focus:outline-none focus:ring-1 focus:ring-border-focus"
            />
            <div className="mt-1 flex justify-between">
              <span className="text-caption text-text-disabled">
                Shown to users when maintenance mode is active.
              </span>
              <span className="text-caption text-text-disabled">
                {(settings.maintenanceMessage ?? "").length}/200
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* App Version */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-accent-green" />
            <CardTitle>App Version Control</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="max-w-[260px]">
            <Input
              label="Minimum Supported Version"
              type="text"
              placeholder="1.0.0"
              value={settings.minimumSupportedVersion}
              onChange={(e) =>
                updateField("minimumSupportedVersion", e.target.value)
              }
              helperText="Users on older versions will be prompted to update."
            />
          </div>

          {switchField(
            "forceUpdateEnabled",
            "Force Update",
            "Block app usage until the user updates to the minimum version. When disabled, users see a dismissible prompt."
          )}
        </CardContent>
      </Card>

      {/* Save bar */}
      <Card>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-4">
          <div className="flex items-center gap-4 text-body-sm text-text-tertiary">
            <span className="flex items-center gap-1.5">
              <Clock className="h-4 w-4" />
              Last saved:{" "}
              <span className="text-text-secondary">
                {formatTimestamp(lastSaved.updatedAt?.seconds)}
              </span>
            </span>
            {lastSaved.updatedByEmail && (
              <span className="flex items-center gap-1.5">
                <User className="h-4 w-4" />
                <span className="text-text-secondary">
                  {lastSaved.updatedByEmail}
                </span>
              </span>
            )}
          </div>

          <Button
            variant="primary"
            size="lg"
            onClick={handleSave}
            disabled={saving || !hasChanges}
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            <Save className="h-4 w-4" />
            Save Configuration
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
