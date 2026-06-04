"use client";

import { useRouter } from "next/navigation";
import {
  Users,
  Radio,
  Package,
  Bell,
  Plus,
  Send,
  Upload,
  BarChart3,
  Activity,
  Clock,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface StatCard {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
  colorBg: string;
}

interface QuickAction {
  label: string;
  icon: React.ReactNode;
  route: string;
  color: string;
}

interface AuditEntry {
  id: string;
  actor: string;
  action: string;
  resource: string;
  timestamp: string;
}

const stats: StatCard[] = [
  {
    label: "Total Users",
    value: "--",
    icon: <Users className="h-5 w-5" />,
    color: "text-accent-blue",
    colorBg: "bg-accent-blue/10",
  },
  {
    label: "Live Matches",
    value: "--",
    icon: <Radio className="h-5 w-5" />,
    color: "text-accent-red",
    colorBg: "bg-accent-red/10",
  },
  {
    label: "Active Packages",
    value: "--",
    icon: <Package className="h-5 w-5" />,
    color: "text-accent-gold",
    colorBg: "bg-accent-gold/10",
  },
  {
    label: "Notifications Sent",
    value: "--",
    icon: <Bell className="h-5 w-5" />,
    color: "text-accent-green",
    colorBg: "bg-accent-green/10",
  },
];

const quickActions: QuickAction[] = [
  {
    label: "Add Match",
    icon: <Plus className="h-4 w-4" />,
    route: "/matches/new",
    color: "text-accent-blue",
  },
  {
    label: "Send Notification",
    icon: <Send className="h-4 w-4" />,
    route: "/notifications",
    color: "text-accent-green",
  },
  {
    label: "Upload Content",
    icon: <Upload className="h-4 w-4" />,
    route: "/packages/new",
    color: "text-accent-orange",
  },
  {
    label: "View Analytics",
    icon: <BarChart3 className="h-4 w-4" />,
    route: "/analytics",
    color: "text-accent-purple",
  },
];

const placeholderAuditLogs: AuditEntry[] = [
  {
    id: "1",
    actor: "System",
    action: "create",
    resource: "Match",
    timestamp: "No audit logs yet",
  },
];

const placeholderMatches = Array.from({ length: 3 }, (_, i) => ({
  id: `${i + 1}`,
  teams: "--- vs ---",
  score: "-- : --",
  status: "scheduled" as const,
  time: "--",
}));

const statusBadgeVariant: Record<string, "live" | "scheduled" | "finished" | "draft"> = {
  live: "live",
  scheduled: "scheduled",
  halfttime: "live",
  finished: "finished",
};

export default function DashboardPage() {
  const router = useRouter();
  const { adminProfile } = useAuth();

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-h2 text-text-primary">Dashboard</h1>
        <p className="text-body text-text-tertiary">
          Welcome back, {adminProfile?.displayName || adminProfile?.email || "Admin"}
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="transition-shadow hover:shadow-md">
            <CardContent className="flex items-center gap-4">
              <div
                className={cn(
                  "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl",
                  stat.colorBg
                )}
              >
                <span className={stat.color}>{stat.icon}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-caption text-text-tertiary">{stat.label}</p>
                <p className="text-h3 text-text-primary">{stat.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {quickActions.map((action) => (
              <Button
                key={action.label}
                variant="outline"
                className="h-auto flex-col gap-2 py-4"
                onClick={() => router.push(action.route)}
              >
                <span className={action.color}>{action.icon}</span>
                <span className="text-body-sm text-text-secondary">
                  {action.label}
                </span>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Two-column: Live Matches + Recent Activity */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Live Matches Preview */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Live Matches</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/matches/live")}
            >
              View All
            </Button>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border-muted text-left">
                    <th className="pb-3 text-label text-text-tertiary">Teams</th>
                    <th className="pb-3 text-label text-text-tertiary">Score</th>
                    <th className="pb-3 text-label text-text-tertiary">Status</th>
                    <th className="pb-3 text-label text-text-tertiary">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {placeholderMatches.map((match, idx) => (
                    <tr
                      key={match.id}
                      className={cn(
                        "text-body-sm",
                        idx === placeholderMatches.length - 1
                          ? ""
                          : "border-b border-border-muted"
                      )}
                    >
                      <td className="py-3 text-text-primary">{match.teams}</td>
                      <td className="py-3 text-text-primary">{match.score}</td>
                      <td className="py-3">
                        <Badge variant={statusBadgeVariant[match.status] || "draft"}>
                          {match.status}
                        </Badge>
                      </td>
                      <td className="py-3 text-text-tertiary">{match.time}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {placeholderMatches.length === 0 && (
                <div className="flex flex-col items-center py-8">
                  <Radio className="mb-3 h-8 w-8 text-text-disabled" />
                  <p className="text-body-sm text-text-tertiary">
                    No live matches at the moment
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Activity</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/audit-logs")}
            >
              View All
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {placeholderAuditLogs.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-start gap-3 rounded-lg border border-border-muted p-3"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-bg-tertiary">
                    <Activity className="h-4 w-4 text-text-tertiary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-body-sm text-text-primary">
                      <span className="font-medium">{entry.actor}</span>{" "}
                      <span className="text-text-tertiary">{entry.action}</span>{" "}
                      {entry.resource}
                    </p>
                    <p className="flex items-center gap-1 text-caption text-text-disabled">
                      <Clock className="h-3 w-3" />
                      {entry.timestamp}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 flex flex-col items-center gap-3 rounded-lg border border-dashed border-border-muted p-6">
              <Activity className="h-6 w-6 text-text-disabled" />
              <p className="text-body-sm text-text-tertiary">
                Activity tracking will appear here once audit logging is
                connected.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
