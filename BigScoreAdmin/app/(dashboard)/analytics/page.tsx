"use client";

import { useState, useMemo } from "react";
import {
  Users,
  Radio,
  Bell,
  Package,
  Play,
  Eye,
  DollarSign,
  TrendingUp,
  Activity,
  BarChart3,
  Download,
  Calendar,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  generateDailyData,
  generateCompetitionData,
  generateDeviceData,
  generateNotificationRateData,
  computeSummary,
  type AnalyticsSummary,
} from "@/lib/services/analytics";
import { LineChart, BarChart, PieChart, NotificationBarChart } from "@/components/charts";

type Range = "7d" | "30d" | "90d";

const rangeDays: Record<Range, number> = { "7d": 7, "30d": 30, "90d": 90 };

function formatMetric(value: number, prefix = "", suffix = ""): string {
  if (value >= 1_000_000) return `${prefix}${(value / 1_000_000).toFixed(1)}M${suffix}`;
  if (value >= 1_000) return `${prefix}${(value / 1_000).toFixed(1)}K${suffix}`;
  return `${prefix}${value}${suffix}`;
}

function csvDownload(data: Array<Record<string, unknown>>, filename: string) {
  if (data.length === 0) return;

  const headers = Object.keys(data[0]);
  const rows = data.map((r) =>
    headers.map((h) => JSON.stringify(String(r[h] ?? ""))).join(",")
  );

  const blob = new Blob(
    [[headers.join(","), ...rows].join("\n")],
    { type: "text/csv;charset=utf-8;" }
  );

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

interface MetricCardProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  color: string;
  colorBg: string;
}

function MetricCard({ label, value, icon, color, colorBg }: MetricCardProps) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-4">
        <div
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
            colorBg
          )}
        >
          <span className={color}>{icon}</span>
        </div>
        <div className="min-w-0">
          <p className="text-caption text-text-tertiary truncate">{label}</p>
          <p className="text-h3 text-text-primary tabular-nums">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AnalyticsPage() {
  const [range, setRange] = useState<Range>("30d");

  const dailyData = useMemo(() => generateDailyData(rangeDays[range]), [range]);
  const summary = useMemo<AnalyticsSummary>(() => computeSummary(dailyData), [dailyData]);
  const competitionData = useMemo(() => generateCompetitionData(), []);
  const deviceData = useMemo(() => generateDeviceData(), []);
  const notificationRateData = useMemo(() => generateNotificationRateData(), []);

  const metrics: MetricCardProps[] = [
    {
      label: "Total Users",
      value: formatMetric(summary.totalUsers),
      icon: <Users className="h-5 w-5" />,
      color: "text-accent-blue",
      colorBg: "bg-accent-blue/10",
    },
    {
      label: "Daily Active Users",
      value: formatMetric(summary.dailyActiveUsers),
      icon: <Activity className="h-5 w-5" />,
      color: "text-accent-green",
      colorBg: "bg-accent-green/10",
    },
    {
      label: "Monthly Active Users",
      value: formatMetric(summary.monthlyActiveUsers),
      icon: <Users className="h-5 w-5" />,
      color: "text-accent-purple",
      colorBg: "bg-accent-purple/10",
    },
    {
      label: "Matches Viewed",
      value: formatMetric(summary.matchesViewed),
      icon: <Eye className="h-5 w-5" />,
      color: "text-accent-orange",
      colorBg: "bg-accent-orange/10",
    },
    {
      label: "Live Matches Viewed",
      value: formatMetric(summary.liveMatchesViewed),
      icon: <Radio className="h-5 w-5" />,
      color: "text-accent-red",
      colorBg: "bg-accent-red/10",
    },
    {
      label: "Notifications Sent",
      value: formatMetric(summary.notificationsSent),
      icon: <Bell className="h-5 w-5" />,
      color: "text-accent-gold",
      colorBg: "bg-accent-gold/10",
    },
    {
      label: "Packages Opened",
      value: formatMetric(summary.packagesOpened),
      icon: <Package className="h-5 w-5" />,
      color: "text-accent-blue",
      colorBg: "bg-accent-blue/10",
    },
    {
      label: "Video Plays",
      value: formatMetric(summary.videoPlays),
      icon: <Play className="h-5 w-5" />,
      color: "text-accent-green",
      colorBg: "bg-accent-green/10",
    },
    {
      label: "Ad Impressions",
      value: formatMetric(summary.adImpressions),
      icon: <BarChart3 className="h-5 w-5" />,
      color: "text-accent-orange",
      colorBg: "bg-accent-orange/10",
    },
    {
      label: "Est. Ad Revenue",
      value: formatMetric(summary.estimatedAdRevenue, "$"),
      icon: <DollarSign className="h-5 w-5" />,
      color: "text-accent-gold",
      colorBg: "bg-accent-gold/10",
    },
  ];

  const ranges: { key: Range; label: string }[] = [
    { key: "7d", label: "7 days" },
    { key: "30d", label: "30 days" },
    { key: "90d", label: "90 days" },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-h2 text-text-primary">Analytics</h1>
          <p className="text-body text-text-tertiary">
            App usage metrics and performance overview
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg bg-bg-secondary p-1">
            {ranges.map((r) => (
              <button
                key={r.key}
                onClick={() => setRange(r.key)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-body-sm transition-colors",
                  range === r.key
                    ? "bg-bg-primary text-text-primary shadow-sm"
                    : "text-text-tertiary hover:text-text-secondary"
                )}
              >
                {r.label}
              </button>
            ))}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              csvDownload(
                dailyData as unknown as Array<Record<string, unknown>>,
                `analytics-${range}.csv`
              )
            }
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Export CSV</span>
          </Button>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {metrics.map((m) => (
          <MetricCard key={m.label} {...m} />
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* User Growth */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-accent-blue" />
              <CardTitle>User Growth</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <LineChart
              data={dailyData as unknown as Array<Record<string, unknown>>}
              xKey="date"
              lines={[
                { key: "users", color: "#00D9FF", label: "Total Users" },
                { key: "activeUsers", color: "#00FF88", label: "Active Users" },
              ]}
            />
          </CardContent>
        </Card>

        {/* Daily Active Users */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-accent-green" />
              <CardTitle>Daily Active Users</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <LineChart
              data={dailyData as unknown as Array<Record<string, unknown>>}
              xKey="date"
              lines={[
                {
                  key: "activeUsers",
                  color: "#00FF88",
                  label: "Active Users",
                },
              ]}
            />
          </CardContent>
        </Card>

        {/* Popular Competitions */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-accent-orange" />
              <CardTitle>Popular Competitions</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <BarChart
              data={competitionData as unknown as Array<Record<string, unknown>>}
              barKey="views"
              labelKey="name"
              color="#FF9500"
            />
          </CardContent>
        </Card>

        {/* Notification Open Rate */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-accent-gold" />
              <CardTitle>Notification Open Rate</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <NotificationBarChart data={notificationRateData} />
          </CardContent>
        </Card>

        {/* Device Breakdown */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-accent-purple" />
              <CardTitle>Device Breakdown</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="flex items-center justify-center">
            <PieChart data={deviceData} height={320} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
