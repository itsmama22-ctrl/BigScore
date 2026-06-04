"use client";

import { useEffect, useState, useCallback } from "react";
import {
  collection, query, orderBy, limit, getDocs,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { queryWithFallback } from "@/lib/queryWithFallback";
import { useAuth } from "@/hooks/useAuth";
import {
  syncLiveResultsAction, syncCompetitionsAction,
  syncTeamsAction, syncNationalTeamsAction,
  syncStandingsAction,
} from "@/app/actions/syncManagement";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Loader2, CheckCircle2, AlertCircle, RefreshCw, Radio, Trophy, Shield, Clock, ListOrdered, CalendarX, Database } from "lucide-react";

interface SyncLogEntry {
  id: string;
  provider: string;
  syncType: string;
  status: string;
  createdCount: number;
  updatedCount: number;
  requestCount: number;
  finishedAt?: { seconds: number };
  errorMessage?: string;
}

interface SyncAction {
  key: string;
  label: string;
  icon: React.ReactNode;
  action: () => Promise<unknown>;
  enabled: boolean;
}

function formatTime(ts?: { seconds: number }): string {
  if (!ts) return "--";
  return new Date(ts.seconds * 1000).toLocaleTimeString();
}

export default function SyncManagementPage() {
  const { adminProfile } = useAuth();

  const [syncState, setSyncState] = useState<Record<string, "idle" | "running">>({});
  const [syncResult, setSyncResult] = useState<Record<string, { success: boolean; message: string } | null>>({});
  const [logs, setLogs] = useState<SyncLogEntry[]>([]);
  const [avail, setAvail] = useState<{
    overallAvailable: boolean;
    summary: string;
    providers: Record<string, { returned: number; reason: string | null; detail: string }>;
  } | null>(null);

  const loadLogs = useCallback(async () => {
    try {
      const list = await Promise.race([
        (async () => {
          const q = query(collection(db, "syncLogs"), orderBy("startedAt", "desc"), limit(20));
          const snap = await getDocs(q);
          const items: SyncLogEntry[] = [];
          snap.forEach((d) => {
            const data = d.data();
            items.push({
              id: d.id,
              provider: data.provider ?? "",
              syncType: data.syncType ?? "",
              status: data.status ?? "",
              createdCount: data.createdCount ?? 0,
              updatedCount: data.updatedCount ?? 0,
              requestCount: data.requestCount ?? 0,
              finishedAt: data.finishedAt,
              errorMessage: data.errorMessage,
            });
          });
          return items;
        })(),
        new Promise<"__timeout__">((resolve) =>
          setTimeout(() => resolve("__timeout__"), 4000)
        ),
      ]);

      if (list === "__timeout__") {
        const fallback = await queryWithFallback({
          collection: "syncLogs",
          orderByField: "startedAt",
          orderByDir: "desc",
          limitCount: 20,
        }) as unknown as SyncLogEntry[];
        setLogs(fallback);
      } else {
        setLogs(list);
      }
    } catch { /* */ }

    try {
      const data = await queryWithFallback({ collection: "appSettings", docId: "liveMatches" });
      if (data.length > 0) {
        setAvail(data[0] as unknown as typeof avail);
      }
    } catch { /* */ }
  }, []);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  async function runSync(key: string, fn: () => Promise<unknown>) {
    if (!adminProfile) return;
    setSyncState((p) => ({ ...p, [key]: "running" }));
    setSyncResult((p) => ({ ...p, [key]: null }));

    try {
      const raw = await fn();
      const result = raw as { success: boolean; error?: string; stats?: { created: number; updated: number } };
      setSyncResult((p) => ({
        ...p,
        [key]: result.success
          ? { success: true, message: `Created ${result.stats?.created ?? 0}, Updated ${result.stats?.updated ?? 0}` }
          : { success: false, message: result.error ?? "Failed." },
      }));
    } catch (err) {
      setSyncResult((p) => ({ ...p, [key]: { success: false, message: err instanceof Error ? err.message : "Failed." } }));
    } finally {
      setSyncState((p) => ({ ...p, [key]: "idle" }));
      loadLogs();
    }
  }

  const syncActions: SyncAction[] = [
    { key: "live", label: "Sync Live Results", icon: <Radio className="h-4 w-4" />, enabled: true,
      action: () => syncLiveResultsAction({ actor: { uid: adminProfile?.uid ?? "", email: adminProfile?.email ?? "", role: adminProfile?.role ?? "" } }) },
    { key: "competitions", label: "Sync Competitions", icon: <Trophy className="h-4 w-4" />, enabled: true,
      action: () => syncCompetitionsAction({ actor: { uid: adminProfile?.uid ?? "", email: adminProfile?.email ?? "", role: adminProfile?.role ?? "" } }) },
    { key: "teams", label: "Sync Club Teams", icon: <Shield className="h-4 w-4" />, enabled: true,
      action: () => syncTeamsAction({ actor: { uid: adminProfile?.uid ?? "", email: adminProfile?.email ?? "", role: adminProfile?.role ?? "" } }) },
    { key: "national", label: "Sync National Teams", icon: <Shield className="h-4 w-4" />, enabled: true,
      action: () => syncNationalTeamsAction({ actor: { uid: adminProfile?.uid ?? "", email: adminProfile?.email ?? "", role: adminProfile?.role ?? "" } }) },
    { key: "standings", label: "Sync Standings", icon: <ListOrdered className="h-4 w-4" />, enabled: true,
      action: () => syncStandingsAction({ actor: { uid: adminProfile?.uid ?? "", email: adminProfile?.email ?? "", role: adminProfile?.role ?? "" } }) },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-h2 text-text-primary">Sync Management</h1>
        <p className="text-body text-text-tertiary">Trigger external API syncs and monitor status</p>
      </div>

      {/* Manual sync triggers */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-accent-gold" />
            <CardTitle>Manual Sync</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {syncActions.map((sa) => {
              const state = syncState[sa.key];
              const res = syncResult[sa.key];
              const isRunning = state === "running";

              return (
                <div key={sa.key} className="flex flex-col gap-2">
                  <Button
                    variant="outline"
                    className="h-auto flex-col gap-2 py-4"
                    onClick={() => runSync(sa.key, sa.action)}
                    disabled={isRunning || !sa.enabled}
                  >
                    {isRunning ? <Loader2 className="h-5 w-5 animate-spin text-accent-blue" /> : sa.icon}
                    <span className="text-body-sm">{sa.label}</span>
                  </Button>

                  {res && (
                    <div className={cn(
                      "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-caption",
                      res.success ? "bg-accent-green/10 text-accent-green" : "bg-accent-red/10 text-accent-red"
                    )}>
                      {res.success ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
                      {res.message}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Scheduled Match Coverage Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CalendarX className="h-5 w-5 text-accent-gold" />
            <CardTitle>Scheduled Match Coverage</CardTitle>
            {avail && (
              <Badge variant={avail.overallAvailable ? "green" : "red"}>
                {avail.overallAvailable ? "Data Available" : "No Data"}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!avail && (
            <div className="flex flex-col items-center gap-3 py-8">
              <Database className="h-8 w-8 text-text-disabled" />
              <p className="text-body-sm text-text-tertiary">Run a full sync to see coverage status.</p>
            </div>
          )}

          {avail && (
            <div className="space-y-4">
              <p className="text-body-sm text-text-secondary whitespace-pre-line">{avail.summary}</p>

              <div className="space-y-2">
                {Object.entries(avail.providers).map(([id, status]) => {
                  const hasData = status.returned > 0;
                  const isPlaceholder = id === "future-fixtures-placeholder";
                  const reasonLabel = status.reason
                    ? status.reason.replace(/_/g, " ")
                    : "available";

                  return (
                    <div
                      key={id}
                      className={cn(
                        "flex items-start gap-3 rounded-lg border p-3",
                        hasData
                          ? "border-accent-green/30 bg-accent-green/5"
                          : isPlaceholder
                            ? "border-border-muted bg-bg-tertiary/30 opacity-60"
                            : "border-accent-red/20 bg-accent-red/5"
                      )}
                    >
                      <div className="mt-0.5">
                        {hasData ? (
                          <CheckCircle2 className="h-4 w-4 text-accent-green" />
                        ) : (
                          <AlertCircle className={cn(
                            "h-4 w-4",
                            isPlaceholder ? "text-text-disabled" : "text-accent-red"
                          )} />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-label text-text-primary capitalize">
                            {isPlaceholder ? "Future-Fixtures Provider" : id}
                          </span>
                          <Badge variant={hasData ? "green" : isPlaceholder ? "draft" : "red"}>
                            {hasData
                              ? `${status.returned} matches`
                              : reasonLabel}
                          </Badge>
                        </div>
                        {status.detail && (
                          <p className="mt-1 text-caption text-text-tertiary leading-relaxed">
                            {status.detail}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sync Logs */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-text-tertiary" />
            <CardTitle>Sync Logs</CardTitle>
            <span className="rounded-full bg-bg-tertiary px-2 py-0.5 text-caption text-text-tertiary">{logs.length}</span>
          </div>
          <Button variant="ghost" size="sm" onClick={loadLogs}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          {logs.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-12">
              <Clock className="h-8 w-8 text-text-disabled" />
              <p className="text-body-sm text-text-tertiary">No sync logs yet. Run a manual sync first.</p>
            </div>
          )}

          {logs.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border-muted text-left">
                    <th className="px-3 py-3 text-label text-text-tertiary">Type</th>
                    <th className="px-3 py-3 text-label text-text-tertiary">Provider</th>
                    <th className="px-3 py-3 text-label text-text-tertiary">Status</th>
                    <th className="px-3 py-3 text-label text-text-tertiary">Created</th>
                    <th className="px-3 py-3 text-label text-text-tertiary">Updated</th>
                    <th className="px-3 py-3 text-label text-text-tertiary">Requests</th>
                    <th className="px-3 py-3 text-label text-text-tertiary">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((l, i) => (
                    <tr key={l.id} className={cn("text-body-sm transition-colors hover:bg-bg-tertiary/50", i !== logs.length - 1 && "border-b border-border-muted")}>
                      <td className="px-3 py-3 text-text-primary capitalize whitespace-nowrap">{l.syncType}</td>
                      <td className="px-3 py-3 text-text-secondary">{l.provider}</td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <Badge variant={l.status === "success" ? "green" : l.status === "failed" ? "red" : l.status === "partial" ? "scheduled" : "draft"}>{l.status}</Badge>
                      </td>
                      <td className="px-3 py-3 text-text-primary tabular-nums">{l.createdCount}</td>
                      <td className="px-3 py-3 text-text-primary tabular-nums">{l.updatedCount}</td>
                      <td className="px-3 py-3 text-text-tertiary">{l.requestCount}</td>
                      <td className="px-3 py-3 text-text-tertiary whitespace-nowrap">{formatTime(l.finishedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
