"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback, useMemo } from "react";
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Link,
  ChevronLeft,
  ChevronRight,
  Radio,
  Filter,
  X,
} from "lucide-react";
import { collection, query, getDocs, where, type QueryConstraint } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/hooks/useAuth";
import { toggleWatchModeAction, deleteMatchAction } from "@/app/actions/matches";
import { queryWithFallback } from "@/lib/queryWithFallback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Modal } from "@/components/ui/modal";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { MatchStatus } from "@/models";

const PAGE_SIZE = 20;

const statusOptions: { value: string; label: string }[] = [
  { value: "all", label: "All Status" },
  { value: "scheduled", label: "Scheduled" },
  { value: "live", label: "Live" },
  { value: "halftime", label: "Halftime" },
  { value: "finished", label: "Finished" },
  { value: "postponed", label: "Postponed" },
  { value: "cancelled", label: "Cancelled" },
];

const statusBadgeVariant: Record<string, "live" | "scheduled" | "finished" | "draft"> = {
  live: "live",
  halfttime: "live",
  scheduled: "scheduled",
  finished: "finished",
  postponed: "draft",
  cancelled: "draft",
};

function formatDateLabel(dateStr: string): string {
  const date = new Date(dateStr + "T12:00:00");
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().slice(0, 10);

  if (dateStr === todayStr) return "Today";
  if (dateStr === yesterdayStr) return "Yesterday";
  if (dateStr === tomorrowStr) return "Tomorrow";

  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

interface Competition {
  id: string;
  name: string;
}

interface MatchData {
  id: string;
  competitionName: string;
  homeTeamName: string;
  awayTeamName: string;
  homeScore?: number;
  awayScore?: number;
  startDate: { seconds: number };
  status: MatchStatus;
  enableWatchMode: boolean;
  streamUrl?: string;
  isPublished: boolean;
}

function formatDateTime(timestamp: { seconds: number }): string {
  const date = new Date(timestamp.seconds * 1000);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatScore(match: MatchData): string {
  if (match.status === "scheduled") return "-- : --";
  if (match.homeScore === undefined || match.awayScore === undefined) return "-- : --";
  return `${match.homeScore} : ${match.awayScore}`;
}

export default function MatchesPage() {
  const router = useRouter();
  const { adminProfile } = useAuth();

  const [allMatches, setAllMatches] = useState<MatchData[]>([]);
  const [matches, setMatches] = useState<MatchData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [statusFilter, setStatusFilter] = useState("all");
  const [competitionFilter, setCompetitionFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDate, setSelectedDate] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<MatchData | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [watchModeLoading, setWatchModeLoading] = useState<Set<string>>(new Set());

  const fetchAllMatches = useCallback(
    async () => {
      setLoading(true);
      setError(null);

      try {
        const constraints: QueryConstraint[] = [];

        if (statusFilter !== "all") {
          constraints.push(where("status", "==", statusFilter));
        }
        if (competitionFilter !== "all") {
          constraints.push(where("competitionId", "==", competitionFilter));
        }

        const list = await Promise.race([
          (async () => {
            const q = query(collection(db, "matches"), ...constraints);
            const snap = await getDocs(q);
            const items: MatchData[] = [];
            snap.forEach((doc) => {
              const data = doc.data();
              const homeTeam = (data.homeTeam as Record<string, unknown>) ?? {};
              const awayTeam = (data.awayTeam as Record<string, unknown>) ?? {};
              const competition = (data.competition as Record<string, unknown>) ?? {};
              const score = (data.score as Record<string, unknown>) ?? {};
              const startDate = (data.date as { seconds: number }) ?? (data.startDate as { seconds: number }) ?? { seconds: 0 };
              items.push({
                id: doc.id,
                competitionName: (competition.name as string) ?? (data.competitionName as string) ?? "",
                homeTeamName: (homeTeam.name as string) ?? (data.homeTeamName as string) ?? "",
                awayTeamName: (awayTeam.name as string) ?? (data.awayTeamName as string) ?? "",
                homeScore: (score.home as number) ?? (data.homeScore as number),
                awayScore: (score.away as number) ?? (data.awayScore as number),
                startDate,
                status: data.status ?? "scheduled",
                enableWatchMode: data.enableWatchMode ?? false,
                streamUrl: data.streamUrl,
                isPublished: data.isPublished ?? false,
              });
            });
            return items;
          })(),
          new Promise<"__timeout__">((resolve) =>
            setTimeout(() => resolve("__timeout__"), 4000)
          ),
        ]);

        if (list === "__timeout__") {
          const filters = [];
          if (statusFilter !== "all") {
            filters.push({ field: "status", op: "==" as const, value: statusFilter });
          }
          if (competitionFilter !== "all") {
            filters.push({ field: "competitionId", op: "==" as const, value: competitionFilter });
          }
          const fallback = await queryWithFallback<MatchData>({
            collection: "matches",
            filters: filters.length > 0 ? filters : undefined,
          });
          setAllMatches(fallback);
          setTotalCount(fallback.length);
        } else {
          setAllMatches(list);
          setTotalCount(list.length);
        }
      } catch (err) {
        console.error("[matches] Failed to fetch:", err);
        setError("Failed to load matches. Please try again.");
      } finally {
        setLoading(false);
      }
    },
    [statusFilter, competitionFilter]
  );

  const availableDates = useMemo(() => {
    const dateSet = new Set<string>();
    allMatches.forEach((m) => {
      const dateStr = new Date(m.startDate.seconds * 1000).toISOString().slice(0, 10);
      dateSet.add(dateStr);
    });
    return Array.from(dateSet).sort().reverse();
  }, [allMatches]);

  const dateOptions = useMemo(() => {
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().slice(0, 10);

    const counts: Record<string, number> = {};
    allMatches.forEach((m) => {
      const dateStr = new Date(m.startDate.seconds * 1000).toISOString().slice(0, 10);
      counts[dateStr] = (counts[dateStr] || 0) + 1;
    });

    const quickDates = [
      { value: "all", label: "All Dates", count: allMatches.length },
      { value: todayStr, label: "Today", count: counts[todayStr] || 0, hideIfZero: true },
      { value: tomorrowStr, label: "Tomorrow", count: counts[tomorrowStr] || 0, hideIfZero: true },
      { value: yesterdayStr, label: "Yesterday", count: counts[yesterdayStr] || 0, hideIfZero: true },
    ];

    const otherDates = availableDates
      .filter((d) => d !== todayStr && d !== yesterdayStr && d !== tomorrowStr)
      .map((d) => ({
        value: d,
        label: formatDateLabel(d),
        count: counts[d] || 0,
      }));

    return [
      ...quickDates.filter((d) => !d.hideIfZero || d.count > 0),
      ...(otherDates.length > 0 ? [{ value: "_divider_", label: "──────────", count: 0, isDivider: true }] : []),
      ...otherDates,
    ].filter((d) => d.value === "_divider_" || d.count > 0 || d.value === "all");
  }, [availableDates, allMatches]);

  useEffect(() => {
    let filtered = [...allMatches];

    if (selectedDate !== "all") {
      const from = new Date(selectedDate).getTime() / 1000;
      const to = new Date(selectedDate + "T23:59:59").getTime() / 1000;
      filtered = filtered.filter((m) => m.startDate.seconds >= from && m.startDate.seconds <= to);
    }

    if (dateFrom) {
      const from = new Date(dateFrom).getTime() / 1000;
      filtered = filtered.filter((m) => m.startDate.seconds >= from);
    }
    if (dateTo) {
      const to = new Date(dateTo + "T23:59:59").getTime() / 1000;
      filtered = filtered.filter((m) => m.startDate.seconds <= to);
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (m) =>
          m.homeTeamName.toLowerCase().includes(term) ||
          m.awayTeamName.toLowerCase().includes(term)
      );
    }

    filtered.sort((a, b) => b.startDate.seconds - a.startDate.seconds);

    setMatches(filtered);
  }, [allMatches, selectedDate, dateFrom, dateTo, searchTerm]);

  useEffect(() => {
    async function loadCompetitions() {
      try {
        const list = await Promise.race([
          (async () => {
            const q = query(collection(db, "competitions"));
            const snap = await getDocs(q);
            const items: Competition[] = [];
            snap.forEach((doc) => {
              items.push({ id: doc.id, name: doc.data().name ?? doc.id });
            });
            return items;
          })(),
          new Promise<"__timeout__">((resolve) =>
            setTimeout(() => resolve("__timeout__"), 4000)
          ),
        ]);

        if (list === "__timeout__") {
          const fallback = await queryWithFallback<Competition>({ collection: "competitions" });
          setCompetitions(fallback);
        } else {
          setCompetitions(list);
        }
      } catch (err) {
        console.error("[matches] Failed to load competitions:", err);
      }
    }
    loadCompetitions();
  }, []);

  useEffect(() => {
    fetchAllMatches();
  }, [fetchAllMatches]);

  function handleNextPage() {
    if (matches.length <= page * PAGE_SIZE) return;
    setPage((p) => p + 1);
  }

  function handlePrevPage() {
    if (page <= 1) return;
    setPage((p) => p - 1);
  }

  async function handleToggleWatchMode(match: MatchData) {
    if (!adminProfile) return;

    setWatchModeLoading((prev) => new Set(prev).add(match.id));

    const result = await toggleWatchModeAction({
      matchId: match.id,
      enabled: !match.enableWatchMode,
      actorUid: adminProfile.uid,
      actorEmail: adminProfile.email,
      actorRole: adminProfile.role,
    });

    setWatchModeLoading((prev) => {
      const next = new Set(prev);
      next.delete(match.id);
      return next;
    });

    if (result.success) {
      setMatches((prev) =>
        prev.map((m) =>
          m.id === match.id ? { ...m, enableWatchMode: !match.enableWatchMode } : m
        )
      );
    }
  }

  async function handleDelete() {
    if (!deleteTarget || !adminProfile) return;

    setDeleting(true);
    setActionError(null);

    const result = await deleteMatchAction({
      matchId: deleteTarget.id,
      actorUid: adminProfile.uid,
      actorEmail: adminProfile.email,
      actorRole: adminProfile.role,
    });

    setDeleting(false);

    if (result.success) {
      setAllMatches((prev) => prev.filter((m) => m.id !== deleteTarget.id));
      setMatches((prev) => prev.filter((m) => m.id !== deleteTarget.id));
      setDeleteTarget(null);
    } else {
      setActionError(result.error ?? "Failed to delete match.");
    }
  }

  function clearFilters() {
    setStatusFilter("all");
    setCompetitionFilter("all");
    setSearchTerm("");
    setSelectedDate("all");
    setDateFrom("");
    setDateTo("");
  }

  const hasActiveFilters =
    statusFilter !== "all" ||
    competitionFilter !== "all" ||
    searchTerm.trim() !== "" ||
    selectedDate !== "all" ||
    dateFrom !== "" ||
    dateTo !== "";

  const canWrite =
    adminProfile?.role === "super_admin" ||
    adminProfile?.role === "content_manager";

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-h2 text-text-primary">Matches</h1>
          <p className="text-body text-text-tertiary">
            Manage match data, scores, and streaming configuration
          </p>
        </div>
        {canWrite && (
          <Button
            variant="primary"
            onClick={() => router.push("/matches/new")}
            className="shrink-0"
          >
            <Plus className="h-4 w-4" />
            Add Match
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowFilters((p) => !p)}
              className={cn(
                "shrink-0",
                showFilters && "bg-bg-tertiary text-text-primary"
              )}
            >
              <Filter className="h-4 w-4" />
              Filters
              {hasActiveFilters && (
                <span className="ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-accent-gold text-caption font-bold text-button-primary-text">
                  !
                </span>
              )}
            </Button>

             <select
               value={selectedDate}
               onChange={(e) => setSelectedDate(e.target.value)}
               className="shrink-0 rounded-lg border border-border-default bg-bg-tertiary px-3 py-2.5 text-body text-text-primary focus:border-border-focus focus:outline-none focus:ring-1 focus:ring-border-focus"
             >
               {dateOptions.map((opt) => (
                 <optgroup key={opt.value}>
                   {opt.value === "_divider_" ? (
                     <option disabled value="_divider_">
                       ──────────
                     </option>
                   ) : (
                     <option key={opt.value} value={opt.value}>
                       {opt.label} ({opt.count})
                     </option>
                   )}
                 </optgroup>
               ))}
             </select>

             <div className="relative flex-1">
               <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
               <input
                 type="text"
                 placeholder="Search by team name..."
                 value={searchTerm}
                 onChange={(e) => setSearchTerm(e.target.value)}
                 className="w-full rounded-lg border border-border-default bg-bg-tertiary py-2.5 pl-10 pr-4 text-body text-text-primary placeholder:text-text-disabled focus:border-border-focus focus:outline-none focus:ring-1 focus:ring-border-focus"
               />
             </div>

             {hasActiveFilters && (
               <Button variant="ghost" size="sm" onClick={clearFilters}>
                 <X className="h-4 w-4" />
                 Clear
               </Button>
             )}
           </div>

          {showFilters && (
            <div className="grid grid-cols-1 gap-3 border-t border-border-muted pt-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="mb-1.5 block text-label text-text-secondary">
                  Status
                </label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full rounded-lg border border-border-default bg-bg-tertiary px-3 py-2.5 text-body text-text-primary focus:border-border-focus focus:outline-none"
                >
                  {statusOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-label text-text-secondary">
                  Competition
                </label>
                <select
                  value={competitionFilter}
                  onChange={(e) => setCompetitionFilter(e.target.value)}
                  className="w-full rounded-lg border border-border-default bg-bg-tertiary px-3 py-2.5 text-body text-text-primary focus:border-border-focus focus:outline-none"
                >
                  <option value="all">All Competitions</option>
                  {competitions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-label text-text-secondary">
                  From Date
                </label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="text-text-primary"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-label text-text-secondary">
                  To Date
                </label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="text-text-primary"
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <Card className="border-border-error">
          <CardContent className="flex items-center justify-between p-6">
             <p className="text-body text-accent-red">{error}</p>
              <Button variant="ghost" size="sm" onClick={() => fetchAllMatches()}>
               Retry
             </Button>
          </CardContent>
        </Card>
      )}

      {/* Loading skeleton */}
      {loading && matches.length === 0 && (
        <Card>
          <CardContent>
            <div className="divide-y divide-border-muted">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-4 py-4">
                  <div className="h-4 w-24 animate-pulse rounded bg-bg-tertiary" />
                  <div className="h-4 w-20 animate-pulse rounded bg-bg-tertiary" />
                  <div className="h-4 w-12 animate-pulse rounded bg-bg-tertiary" />
                  <div className="h-4 w-20 animate-pulse rounded bg-bg-tertiary" />
                  <div className="h-4 w-32 animate-pulse rounded bg-bg-tertiary" />
                  <div className="h-4 w-16 animate-pulse rounded bg-bg-tertiary" />
                  <div className="ml-auto h-8 w-16 animate-pulse rounded bg-bg-tertiary" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {!loading && matches.length === 0 && !error && (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-16">
            <Radio className="h-10 w-10 text-text-disabled" />
            <div className="text-center">
              <p className="text-body text-text-tertiary">
                {hasActiveFilters
                  ? "No matches match your current filters."
                  : "No matches found."}
              </p>
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="mt-2"
                >
                  Clear filters
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Table */}
      {matches.length > 0 && (
        <Card>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border-muted bg-bg-tertiary">
                    <th className="px-4 py-3 text-left text-label text-text-tertiary">
                      Competition
                    </th>
                    <th className="px-4 py-3 text-left text-label text-text-tertiary">
                      Home Team
                    </th>
                    <th className="px-4 py-3 text-center text-label text-text-tertiary">
                      Score
                    </th>
                    <th className="px-4 py-3 text-left text-label text-text-tertiary">
                      Away Team
                    </th>
                    <th className="px-4 py-3 text-left text-label text-text-tertiary whitespace-nowrap">
                      Date &amp; Time
                    </th>
                    <th className="px-4 py-3 text-left text-label text-text-tertiary">
                      Status
                    </th>
                    <th className="px-4 py-3 text-center text-label text-text-tertiary whitespace-nowrap">
                      Watch Mode
                    </th>
                    <th className="px-4 py-3 text-right text-label text-text-tertiary">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {matches.map((match, idx) => {
                    const isLast = idx === matches.length - 1;
                    return (
                      <tr
                        key={match.id}
                        className={cn(
                          "transition-colors hover:bg-bg-tertiary/50",
                          !isLast && "border-b border-border-muted"
                        )}
                      >
                        <td className="px-4 py-3 text-body-sm text-text-secondary whitespace-nowrap">
                          {match.competitionName}
                        </td>
                        <td className="px-4 py-3 text-body-sm text-text-primary whitespace-nowrap">
                          {match.homeTeamName}
                        </td>
                        <td className="px-4 py-3 text-center text-body-sm font-semibold text-accent-gold whitespace-nowrap tabular-nums">
                          {formatScore(match)}
                        </td>
                        <td className="px-4 py-3 text-body-sm text-text-primary whitespace-nowrap">
                          {match.awayTeamName}
                        </td>
                        <td className="px-4 py-3 text-body-sm text-text-tertiary whitespace-nowrap">
                          {formatDateTime(match.startDate)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge
                              variant={statusBadgeVariant[match.status] || "draft"}
                              className="capitalize"
                            >
                              {match.status}
                            </Badge>
                            {!match.isPublished && <Badge variant="draft">Draft</Badge>}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          <div className="flex justify-center">
                            <Switch
                              checked={match.enableWatchMode}
                              onCheckedChange={() => handleToggleWatchMode(match)}
                              disabled={
                                !canWrite || watchModeLoading.has(match.id)
                              }
                              aria-label={`Toggle watch mode for ${match.homeTeamName} vs ${match.awayTeamName}`}
                            />
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1">
                            {canWrite && match.streamUrl && (
                              <button
                                onClick={() =>
                                  router.push(`/matches/${match.id}/edit`)
                                }
                                className="rounded-md p-1.5 text-text-tertiary transition-colors hover:bg-bg-tertiary hover:text-text-primary"
                                title="Edit stream URL"
                              >
                                <Link className="h-4 w-4" />
                              </button>
                            )}
                            {canWrite && (
                              <>
                                <button
                                  onClick={() =>
                                    router.push(`/matches/${match.id}/edit`)
                                  }
                                  className="rounded-md p-1.5 text-text-tertiary transition-colors hover:bg-bg-tertiary hover:text-accent-blue"
                                  title="Edit match"
                                >
                                  <Edit className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => setDeleteTarget(match)}
                                  className="rounded-md p-1.5 text-text-tertiary transition-colors hover:bg-bg-tertiary hover:text-accent-red"
                                  title="Delete match"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between border-t border-border-muted px-4 py-3">
              <p className="text-body-sm text-text-tertiary">
                Page {page} &middot; {matches.length} row{matches.length !== 1 ? "s" : ""}{" "}
                on this page
                {totalCount > 0 && (
                  <span className="hidden sm:inline">
                    {" "}
                    &middot; {totalCount} total
                  </span>
                )}
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={handlePrevPage}
                  disabled={page <= 1 || loading}
                  className="rounded-md p-1.5 text-text-tertiary transition-colors hover:text-text-primary disabled:opacity-30"
                  aria-label="Previous page"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  onClick={handleNextPage}
                  disabled={matches.length <= page * PAGE_SIZE || loading}
                  className="rounded-md p-1.5 text-text-tertiary transition-colors hover:text-text-primary disabled:opacity-30"
                  aria-label="Next page"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Delete confirmation modal */}
      <Modal
        open={!!deleteTarget}
        onClose={() => {
          setDeleteTarget(null);
          setActionError(null);
        }}
        title="Delete Match"
        description="This action cannot be undone. The match and all associated data will be permanently removed."
        variant="danger"
      >
        {deleteTarget && (
          <div className="space-y-4">
            <p className="text-body text-text-secondary">
              Are you sure you want to delete the match{" "}
              <span className="font-semibold text-text-primary">
                {deleteTarget.homeTeamName} vs {deleteTarget.awayTeamName}
              </span>
              ?
            </p>

            {actionError && (
              <p className="text-caption text-accent-red">{actionError}</p>
            )}

            <div className="flex justify-end gap-3">
              <Button
                variant="ghost"
                onClick={() => {
                  setDeleteTarget(null);
                  setActionError(null);
                }}
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                loading={deleting}
                onClick={handleDelete}
              >
                Delete Match
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
