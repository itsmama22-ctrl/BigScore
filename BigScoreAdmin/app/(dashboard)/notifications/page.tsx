"use client";

import { useEffect, useState, useCallback } from "react";
import {
  collection,
  query,
  orderBy,
  getDocs,
  limit,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/hooks/useAuth";
import { NotificationForm } from "@/components/forms/NotificationForm";
import { getNotificationsAction } from "@/app/actions/notifications";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  Bell,
  Search,
  X,
  Clock,
  User,
  History,
  Radio,
} from "lucide-react";

interface NotificationEntry {
  id: string;
  title_en: string;
  body_en: string;
  title_ar?: string;
  body_ar?: string;
  title_fr?: string;
  body_fr?: string;
  notificationType: string;
  targetAudience: string;
  status: "sent" | "scheduled" | "draft" | "failed";
  sentAt?: { seconds: number };
  sentByEmail?: string;
  sentBy?: string;
  recipientCount?: number;
  deliveredCount?: number;
  languages?: string;
}

const typeLabels: Record<string, string> = {
  matchStart: "Match Start",
  goal: "Goal",
  matchEnd: "Match End",
  news: "News",
  announcement: "Announcement",
};

const audienceLabels: Record<string, string> = {
  allUsers: "All Users",
  topic: "Topic",
  teamFollowers: "Team Followers",
  matchFollowers: "Match Followers",
};

const statusBadgeVariant: Record<string, "green" | "scheduled" | "draft" | "red"> = {
  sent: "green",
  scheduled: "scheduled",
  draft: "draft",
  failed: "red",
};

function formatSentAt(ts?: { seconds: number }): string {
  if (!ts) return "--";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(ts.seconds * 1000));
}

export default function NotificationsPage() {
  const { adminProfile } = useAuth();

  const [notifications, setNotifications] = useState<NotificationEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  const canSend =
    adminProfile?.role === "super_admin" ||
    adminProfile?.role === "moderator";

  const loadHistory = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await Promise.race([
        (async () => {
          const q = query(
            collection(db, "notifications"),
            orderBy("createdAt", "desc"),
            limit(100)
          );
          const snap = await getDocs(q);
          const list: NotificationEntry[] = [];
          snap.forEach((doc) => {
            const d = doc.data();
            const hasAr = !!(d.title_ar || d.body_ar);
            const hasFr = !!(d.title_fr || d.body_fr);
            const langs = hasAr && hasFr ? "EN, AR, FR" : hasAr ? "EN, AR" : hasFr ? "EN, FR" : "EN";
              list.push({
                id: doc.id,
                title_en: d.title_en ?? d.title ?? "",
                  body_en: d.body_en ?? d.body ?? "",
                title_ar: d.title_ar,
                body_ar: d.body_ar,
                title_fr: d.title_fr,
                body_fr: d.body_fr,
                notificationType: d.notificationType ?? "announcement",
                targetAudience: d.targetAudience ?? "allUsers",
                status: d.status ?? "sent",
                sentAt: d.sentAt,
                sentByEmail: d.sentByEmail,
                sentBy: d.sentBy,
                recipientCount: d.recipientCount,
                deliveredCount: d.deliveredCount,
                languages: langs,
              });
          });
          return list;
        })(),
        new Promise<"__timeout__">((resolve) =>
          setTimeout(() => resolve("__timeout__"), 3000)
        ),
      ]);

      if (data === "__timeout__") {
        const fallback = await getNotificationsAction();
        setNotifications(fallback as NotificationEntry[]);
        return;
      }

      setNotifications(data);
    } catch (err) {
      console.error("[notifications]", err);
      setError("Failed to load notification history.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // Local cron: dispatch due scheduled notifications every 30s
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/dispatch-notifications");
        const json = await res.json();
        console.log("[cron] dispatch result:", json);
      } catch (err) {
        console.error("[cron] dispatch error:", err);
      }
    }, 30_000);
    return () => clearInterval(interval);
  }, []);

  const filtered = notifications.filter((n) => {
    if (search && !n.title_en.toLowerCase().includes(search.toLowerCase()))
      return false;
    if (typeFilter !== "all" && n.notificationType !== typeFilter) return false;
    return true;
  });

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-h2 text-text-primary">Notifications</h1>
        <p className="text-body text-text-tertiary">
          Compose and send push notifications to iOS app users
        </p>
      </div>

      {/* Composer */}
      {canSend && <NotificationForm onSent={loadHistory} />}

      {!canSend && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12">
            <Bell className="h-8 w-8 text-text-disabled" />
            <p className="text-body text-text-tertiary">
              You have view-only access. Only super admins and moderators can
              send notifications.
            </p>
          </CardContent>
        </Card>
      )}

      {/* History */}
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-text-tertiary" />
            <CardTitle>History</CardTitle>
            <span className="rounded-full bg-bg-tertiary px-2 py-0.5 text-caption text-text-tertiary">
              {notifications.length}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="rounded-lg border border-border-default bg-bg-tertiary px-3 py-2 text-body-sm text-text-primary focus:border-border-focus focus:outline-none"
            >
              <option value="all">All Types</option>
              {Object.entries(typeLabels).map(([val, label]) => (
                <option key={val} value={val}>
                  {label}
                </option>
              ))}
            </select>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
              <input
                type="text"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-36 rounded-lg border border-border-default bg-bg-tertiary py-2 pl-10 pr-3 text-body-sm text-text-primary placeholder:text-text-disabled focus:border-border-focus focus:outline-none sm:w-48"
              />
            </div>

            {search && (
              <Button variant="ghost" size="sm" onClick={() => setSearch("")}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {/* Error */}
          {error && (
            <div className="mb-4 flex items-center justify-between rounded-lg border border-border-error p-3">
              <p className="text-body-sm text-accent-red">{error}</p>
              <Button variant="ghost" size="sm" onClick={loadHistory}>
                Retry
              </Button>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="h-14 animate-pulse rounded-lg bg-bg-tertiary"
                />
              ))}
            </div>
          )}

          {/* Empty */}
          {!loading && filtered.length === 0 && !error && (
            <div className="flex flex-col items-center gap-3 py-12">
              <Radio className="h-8 w-8 text-text-disabled" />
              <p className="text-body text-text-tertiary">
                {search || typeFilter !== "all"
                  ? "No notifications match your filters."
                  : "No notifications have been sent yet."}
              </p>
            </div>
          )}

          {/* Table */}
          {!loading && filtered.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border-muted text-left">
                    <th className="px-3 py-3 text-label text-text-tertiary">
                      Title
                    </th>
                    <th className="px-3 py-3 text-label text-text-tertiary">
                      Type
                    </th>
                    <th className="px-3 py-3 text-label text-text-tertiary">
                      Target
                    </th>
                    <th className="px-3 py-3 text-label text-text-tertiary">
                      Languages
                    </th>
                    <th className="px-3 py-3 text-label text-text-tertiary">
                      Sent
                    </th>
                    <th className="px-3 py-3 text-label text-text-tertiary">
                      Status
                    </th>
                    <th className="px-3 py-3 text-label text-text-tertiary">
                      Recipients
                    </th>
                    <th className="px-3 py-3 text-label text-text-tertiary">
                      Sent By
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((n, idx) => (
                    <tr
                      key={n.id}
                      className={cn(
                        "transition-colors hover:bg-bg-tertiary/50",
                        idx !== filtered.length - 1 && "border-b border-border-muted"
                      )}
                    >
                      <td className="px-3 py-3">
                        <p className="text-body-sm font-medium text-text-primary max-w-[200px] truncate" title={n.title_en}>
                          {n.title_en}
                        </p>
                      </td>
                      <td className="px-3 py-3">
                        <Badge variant="blue">
                          {typeLabels[n.notificationType] ?? n.notificationType}
                        </Badge>
                      </td>
                      <td className="px-3 py-3 text-body-sm text-text-secondary">
                        {audienceLabels[n.targetAudience] ?? n.targetAudience}
                      </td>
                      <td className="px-3 py-3">
                        <span className="text-caption text-text-tertiary font-mono text-xs">
                          {n.languages}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <span className="flex items-center gap-1.5 text-body-sm text-text-tertiary whitespace-nowrap">
                          <Clock className="h-3.5 w-3.5" />
                          {formatSentAt(n.sentAt)}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <Badge
                          variant={
                            statusBadgeVariant[n.status] || "draft"
                          }
                          className="capitalize"
                        >
                          {n.status}
                        </Badge>
                      </td>
                      <td className="px-3 py-3 text-body-sm text-text-secondary">
                        {n.recipientCount != null ? (
                          <span className="tabular-nums">
                            {n.deliveredCount != null
                              ? `${n.deliveredCount.toLocaleString()} / ${n.recipientCount.toLocaleString()}`
                              : n.recipientCount.toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-text-disabled">--</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <span className="flex items-center gap-1.5 text-body-sm text-text-tertiary">
                          <User className="h-3.5 w-3.5" />
                          {n.sentByEmail || "System"}
                        </span>
                      </td>
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
