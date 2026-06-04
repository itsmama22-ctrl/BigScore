"use client";

import { useEffect, useState, useCallback } from "react";
import {
  collection,
  query,
  orderBy,
  limit,
  getDocs,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { queryWithFallback } from "@/lib/queryWithFallback";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Search,
  X,
  History,
  User,
  FileText,
  Calendar,
  Clock,
} from "lucide-react";

interface AuditEntry {
  id: string;
  actorEmail: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  description: string;
  createdAt?: { seconds: number };
}

const actionBadgeVariant: Record<string, "green" | "blue" | "red" | "gold" | "purple" | "orange"> = {
  login: "green",
  create: "blue",
  update: "gold",
  delete: "red",
  send_notification: "purple",
  change_role: "orange",
  disable_user: "red",
  update_config: "gold",
  update_stream_url: "blue",
  publish: "green",
  unpublish: "orange",
  toggle_feature: "purple",
};

const actionLabels: Record<string, string> = {
  login: "Login",
  create: "Create",
  update: "Update",
  delete: "Delete",
  send_notification: "Send Notification",
  change_role: "Change Role",
  disable_user: "Disable User",
  update_config: "Update Config",
  update_stream_url: "Update Stream URL",
  publish: "Publish",
  unpublish: "Unpublish",
  toggle_feature: "Toggle Feature",
};

const resourceTypes = [
  "match",
  "package",
  "channel",
  "mediaContent",
  "news",
  "competition",
  "team",
  "adminUser",
  "notification",
  "appSettings",
];

export default function AuditLogsPage() {
  const { adminProfile } = useAuth();

  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [resourceFilter, setResourceFilter] = useState("all");

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const list = await Promise.race([
        (async () => {
          const q = query(
            collection(db, "auditLogs"),
            orderBy("createdAt", "desc"),
            limit(200)
          );
          const snap = await getDocs(q);

          const resultList: AuditEntry[] = [];
          snap.forEach((d) => {
            const dt = d.data();
            resultList.push({
              id: d.id,
              actorEmail: dt.actorEmail ?? "Unknown",
              action: dt.action ?? "",
              resourceType: dt.resourceType ?? "",
              resourceId: dt.resourceId,
              description: dt.description ?? "",
              createdAt: dt.createdAt,
            });
          });

          return resultList;
        })(),
        new Promise<"__timeout__">((resolve) =>
          setTimeout(() => resolve("__timeout__"), 4000)
        ),
      ]);

      if (list === "__timeout__") {
        const fallback = await queryWithFallback({
          collection: "auditLogs",
          orderByField: "createdAt",
          orderByDir: "desc",
          limitCount: 200,
        }) as unknown as AuditEntry[];
        setLogs(fallback);
      } else {
        setLogs(list);
      }
    } catch (err) {
      console.error("[audit-logs]", err);
      setError("Failed to load audit logs.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  function formatTimestamp(ts?: { seconds: number }): string {
    if (!ts) return "--";
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(new Date(ts.seconds * 1000));
  }

  const filtered = logs.filter((l) => {
    if (search) {
      const s = search.toLowerCase();
      if (
        !l.actorEmail.toLowerCase().includes(s) &&
        !l.description.toLowerCase().includes(s) &&
        !(l.resourceId ?? "").toLowerCase().includes(s)
      )
        return false;
    }
    if (actionFilter !== "all" && l.action !== actionFilter) return false;
    if (resourceFilter !== "all" && l.resourceType !== resourceFilter) return false;
    return true;
  });

  const isSuperAdmin = adminProfile?.role === "super_admin";

  if (!isSuperAdmin) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-h2 text-text-primary">Audit Logs</h1>
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-16">
            <History className="h-10 w-10 text-text-disabled" />
            <p className="text-body text-text-tertiary">
              Only super admins can view audit logs.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-h2 text-text-primary">Audit Logs</h1>
        <p className="text-body text-text-tertiary">
          Complete record of all administrative actions in the platform.
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
            <input
              type="text"
              placeholder="Search by email, description, or resource ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-border-default bg-bg-tertiary py-2.5 pl-10 pr-4 text-body-sm text-text-primary placeholder:text-text-disabled focus:border-border-focus focus:outline-none"
            />
          </div>

          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="rounded-lg border border-border-default bg-bg-tertiary px-3 py-2.5 text-body-sm text-text-primary focus:border-border-focus focus:outline-none"
          >
            <option value="all">All Actions</option>
            {Object.entries(actionLabels).map(([val, label]) => (
              <option key={val} value={val}>
                {label}
              </option>
            ))}
          </select>

          <select
            value={resourceFilter}
            onChange={(e) => setResourceFilter(e.target.value)}
            className="rounded-lg border border-border-default bg-bg-tertiary px-3 py-2.5 text-body-sm text-text-primary focus:border-border-focus focus:outline-none"
          >
            <option value="all">All Resources</option>
            {resourceTypes.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>

          {(search || actionFilter !== "all" || resourceFilter !== "all") && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch("");
                setActionFilter("all");
                setResourceFilter("all");
              }}
            >
              <X className="h-4 w-4" />
              Clear
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <Card className="border-border-error">
          <CardContent className="flex items-center justify-between p-4">
            <p className="text-body text-accent-red">{error}</p>
            <Button variant="ghost" size="sm" onClick={loadLogs}>
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Loading */}
      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-16 animate-pulse rounded-lg bg-bg-secondary"
            />
          ))}
        </div>
      )}

      {/* Empty */}
      {!loading && filtered.length === 0 && !error && (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-16">
            <FileText className="h-10 w-10 text-text-disabled" />
            <p className="text-body text-text-tertiary">
              {search || actionFilter !== "all" || resourceFilter !== "all"
                ? "No audit logs match your filters."
                : "No audit logs recorded yet."}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Table */}
      {!loading && filtered.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border-muted bg-bg-tertiary">
                    <th className="px-4 py-3 text-left text-label text-text-tertiary whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5" /> Actor
                      </span>
                    </th>
                    <th className="px-4 py-3 text-left text-label text-text-tertiary">
                      Action
                    </th>
                    <th className="px-4 py-3 text-left text-label text-text-tertiary">
                      Resource
                    </th>
                    <th className="px-4 py-3 text-left text-label text-text-tertiary max-w-[300px]">
                      Description
                    </th>
                    <th className="px-4 py-3 text-right text-label text-text-tertiary whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5" /> Timestamp
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((l, idx) => (
                    <tr
                      key={l.id}
                      className={cn(
                        "transition-colors hover:bg-bg-tertiary/50",
                        idx !== filtered.length - 1 &&
                          "border-b border-border-muted"
                      )}
                    >
                      <td className="px-4 py-3">
                        <span className="text-body-sm text-text-primary">
                          {l.actorEmail}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <Badge
                          variant={actionBadgeVariant[l.action] || "blue"}
                          className="capitalize"
                        >
                          {actionLabels[l.action] ?? l.action}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                          <span className="text-body-sm text-text-secondary capitalize">
                            {l.resourceType}
                          </span>
                          {l.resourceId && (
                            <span className="text-caption text-text-disabled font-mono">
                              {l.resourceId}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-body-sm text-text-secondary max-w-[300px] truncate">
                          {l.description}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 text-body-sm text-text-tertiary">
                          <Clock className="h-3.5 w-3.5" />
                          {formatTimestamp(l.createdAt)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Footer with count */}
            <div className="border-t border-border-muted px-4 py-3">
              <p className="text-body-sm text-text-tertiary">
                Showing {filtered.length} of {logs.length} audit logs
                {search || actionFilter !== "all" || resourceFilter !== "all"
                  ? " (filtered)"
                  : ""}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
