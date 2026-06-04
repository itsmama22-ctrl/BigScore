"use client";

import { useEffect, useState, useCallback } from "react";
import { collection, query, where, getDocs, doc, updateDoc, getDoc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Modal } from "@/components/ui/modal";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { getCompetitionPriority, compareCompetitions } from "@/lib/services/competitionPriority";
import { Radio, RefreshCw, Minus, Plus, Bell, ExternalLink } from "lucide-react";
import { queryWithFallback } from "@/lib/queryWithFallback";

function startOfToday(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function endOfToday(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

function isToday(ts?: { seconds: number }): boolean {
  if (!ts || typeof ts.seconds !== "number") return false;
  const d = new Date(ts.seconds * 1000);
  return d >= startOfToday() && d <= endOfToday();
}

interface LiveMatch {
  id: string; sport: string; competitionName: string; competitionCountry?: string; homeTeamName: string; awayTeamName: string;
  homeScore?: number; awayScore?: number; currentMinute?: number; period?: string;
  status: string; enableWatchMode: boolean; streamUrl?: string; stadium?: string;
  venueDisplayText?: string; sourceType: string; isPublished: boolean; startDate?: { seconds: number };
}

export default function LiveMatchesPage() {
  const { adminProfile } = useAuth();
  const canWrite = adminProfile?.role === "super_admin" || adminProfile?.role === "content_manager" || adminProfile?.role === "moderator";
  const [matches, setMatches] = useState<LiveMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<{ lastSyncAt?: { seconds: number }; lastSyncStatus?: string; lastSyncResult?: { created?: number; updated?: number } } | null>(null);
  const [editingStream, setEditingStream] = useState<LiveMatch | null>(null);
  const [newStreamUrl, setNewStreamUrl] = useState("");
  const [saving, setSaving] = useState(false);

   const loadLiveMatches = useCallback(async () => {
     setLoading(true);
     try {
       const list = await Promise.race([
         (async () => {
           const q = query(collection(db, "matches"), where("status", "in", ["live", "halftime", "scheduled", "finished"]));
           const snap = await getDocs(q);
           const items: LiveMatch[] = [];
           snap.forEach((d) => {
             const data = d.data();
             const ht = (data.homeTeam as Record<string, unknown>) ?? {};
             const at = (data.awayTeam as Record<string, unknown>) ?? {};
             const comp = (data.competition as Record<string, unknown>) ?? {};
             const sc = (data.score as Record<string, unknown>) ?? {};
             const matchDate = (data.date as { seconds: number }) ?? (data.startDate as { seconds: number });
             const status = (data.status as string) ?? "live";
             const isLiveOrHalftime = status === "live" || status === "halftime";
             if (!isLiveOrHalftime && !isToday(matchDate)) return;
             items.push({
               id: d.id, sport: (data.sport as string) ?? "Football",
               competitionName: (comp.name as string) ?? (data.competitionName as string) ?? "",
               competitionCountry: (comp.country as string) ?? undefined,
               homeTeamName: (ht.name as string) ?? (data.homeTeamName as string) ?? "",
               awayTeamName: (at.name as string) ?? (data.awayTeamName as string) ?? "",
               homeScore: (sc.home as number) ?? (data.homeScore as number),
               awayScore: (sc.away as number) ?? (data.awayScore as number),
               currentMinute: (data.minute as number) ?? (data.currentMinute as number),
               period: (data.period as string),
               status,
               enableWatchMode: data.enableWatchMode ?? false, streamUrl: data.streamUrl,
               stadium: data.stadium, venueDisplayText: data.venueDisplayText,
               sourceType: data.sourceType ?? "manual", isPublished: data.isPublished ?? false,
               startDate: matchDate,
             });
           });
           items.sort((a, b) => {
             const statusOrder: Record<string, number> = { live: 0, halftime: 1, scheduled: 2, finished: 3 };
             const orderA = statusOrder[a.status] ?? 99;
             const orderB = statusOrder[b.status] ?? 99;
             if (orderA !== orderB) return orderA - orderB;
             const compCompare = compareCompetitions(a.competitionName, b.competitionName, a.competitionCountry, b.competitionCountry);
             if (compCompare !== 0) return compCompare;
             const timeA = a.startDate?.seconds ?? 0;
             const timeB = b.startDate?.seconds ?? 0;
             return timeA - timeB;
           });
           return items;
         })(),
         new Promise<"__timeout__">((resolve) =>
           setTimeout(() => resolve("__timeout__"), 4000)
         ),
       ]);

       if (list === "__timeout__") {
         const fallback = await queryWithFallback<LiveMatch>({
           collection: "matches",
           filters: [{ field: "status", op: "in", value: ["live", "halftime", "scheduled", "finished"] }],
         });
         const filtered = fallback.filter((m) => {
           const isLiveOrHalftime = m.status === "live" || m.status === "halftime";
           return isLiveOrHalftime || isToday(m.startDate);
         });
         filtered.sort((a, b) => {
           const statusOrder: Record<string, number> = { live: 0, halftime: 1, scheduled: 2, finished: 3 };
           const orderA = statusOrder[a.status] ?? 99;
           const orderB = statusOrder[b.status] ?? 99;
           if (orderA !== orderB) return orderA - orderB;
           const timeA = a.startDate?.seconds ?? 0;
           const timeB = b.startDate?.seconds ?? 0;
           return timeA - timeB;
         });
         setMatches(filtered);
       } else {
         setMatches(list);
       }
     } catch (e) { console.error("[live-matches]", e); } finally { setLoading(false); }
   }, []);

   useEffect(() => { loadLiveMatches(); }, [loadLiveMatches]);

   useEffect(() => {
     queryWithFallback({ collection: "appSettings", docId: "liveMatches" }).then((data) => {
       if (data.length > 0) setLastSync(data[0] as typeof lastSync);
     }).catch(() => {});
   }, []);

  async function handleRefresh() { setRefreshing(true); await loadLiveMatches(); setRefreshing(false); }

  async function handleSync() {
    setSyncing(true);
    try {
      await fetch("/api/live-sync?mode=live", { method: "POST" });
      await loadLiveMatches();
      const data = await queryWithFallback({ collection: "appSettings", docId: "liveMatches" });
      if (data.length > 0) setLastSync(data[0] as typeof lastSync);
    } catch (e) { console.error("[live-sync]", e); }
    finally { setSyncing(false); }
  }

  async function updateMatchField(matchId: string, changes: Record<string, unknown>) {
    if (!canWrite) return; setSaving(true);
    try { await updateDoc(doc(db, "matches", matchId), { ...changes, updatedAt: Timestamp.now() } as never);
      setMatches((p) => p.map((m) => m.id === matchId ? { ...m, ...changes } : m)); } catch { /* */ } finally { setSaving(false); }
  }
  async function quickUpdate(match: LiveMatch, field: string, value: number) {
    await updateMatchField(match.id, { [field]: Math.max(0, value) });
  }
  async function updateStatus(match: LiveMatch, status: string) {
    const c: Record<string, unknown> = { status };
    if (status === "finished") { c.currentMinute = 90; c.period = "FT"; }
    if (status === "halftime") { c.period = "Halftime"; }
    await updateDoc(doc(db, "matches", match.id), { ...c, updatedAt: Timestamp.now() } as never);
    setMatches((p) => p.map((m) => m.id === match.id ? { ...m, ...c } : m));
  }
  async function handleSaveStreamUrl() {
    if (!editingStream || !canWrite) return; setSaving(true);
    try { await updateDoc(doc(db, "matches", editingStream.id), { streamUrl: newStreamUrl, updatedAt: Timestamp.now() } as never);
      setMatches((p) => p.map((m) => m.id === editingStream.id ? { ...m, streamUrl: newStreamUrl } : m)); setEditingStream(null); } catch { /* */ } finally { setSaving(false); }
  }
  function formatMinute(match: LiveMatch): string {
    if (match.currentMinute == null) return "--";
    if (match.period && match.period !== "FT") return `${match.currentMinute}' (${match.period})`;
    return `${match.currentMinute}'`;
  }

  const liveMatches = matches.filter((m) => m.status === "live" || m.status === "halftime");
  const scheduledMatches = matches.filter((m) => m.status === "scheduled");
  const finishedMatches = matches.filter((m) => m.status === "finished");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div><h1 className="text-h2 text-text-primary">Live Matches</h1><p className="text-body text-text-tertiary">All matches for today (scheduled, live, finished)</p></div>
        <div className="flex items-center gap-2">
          {lastSync?.lastSyncAt && (
            <span className="text-caption text-text-tertiary whitespace-nowrap">
              Last sync: {new Date(lastSync.lastSyncAt.seconds * 1000).toLocaleString()}
              {lastSync.lastSyncResult && ` (${lastSync.lastSyncResult.created ?? 0} created, ${lastSync.lastSyncResult.updated ?? 0} updated)`}
            </span>
          )}
          <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing}>
            <RefreshCw className={cn("mr-1 h-4 w-4", syncing && "animate-spin")} />
            {syncing ? "Syncing..." : "Sync Live Matches"}
          </Button>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={cn("mr-1 h-4 w-4", refreshing && "animate-spin")} />Refresh
          </Button>
        </div>
      </div>

      {loading && <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-24 animate-pulse rounded-lg bg-bg-secondary" />)}</div>}

      {!loading && matches.length === 0 && (
        <Card><CardContent className="flex flex-col items-center gap-4 py-16"><Radio className="h-10 w-10 text-text-disabled" /><p className="text-body text-text-tertiary">No live matches at the moment.</p></CardContent></Card>
      )}

      {!loading && liveMatches.length > 0 && (
        <div><h2 className="mb-3 text-h3 text-accent-red">Live / Halftime</h2>
          <div className="flex flex-col gap-4">{liveMatches.map((m) => renderCard(m))}</div>
        </div>
      )}

      {!loading && scheduledMatches.length > 0 && (
        <div className="mt-4"><h2 className="mb-3 text-h3 text-accent-orange">Scheduled Today</h2>
          <div className="flex flex-col gap-4">{scheduledMatches.map((m) => renderCard(m))}</div>
        </div>
      )}

      {!loading && finishedMatches.length > 0 && (
        <div className="mt-4"><h2 className="mb-3 text-h3 text-accent-green">Finished Today</h2>
          <div className="flex flex-col gap-4">{finishedMatches.map((m) => renderCard(m))}</div>
        </div>
      )}

      <Modal open={!!editingStream} onClose={() => setEditingStream(null)} title="Edit Stream URL" size="sm">
        {editingStream && (<div className="flex flex-col gap-4"><p className="text-body-sm text-text-secondary">{editingStream.homeTeamName} vs {editingStream.awayTeamName}</p><Input label="Stream URL" type="url" placeholder="https://..." value={newStreamUrl} onChange={(e) => setNewStreamUrl(e.target.value)} /><div className="flex justify-end gap-3"><Button variant="ghost" onClick={() => setEditingStream(null)} disabled={saving}>Cancel</Button><Button variant="primary" loading={saving} onClick={handleSaveStreamUrl}>Save</Button></div></div>)}
      </Modal>
    </div>
  );

  function renderCard(match: LiveMatch) {
    return (
      <Card key={match.id} className="transition-shadow hover:shadow-md">
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={match.status === "scheduled" ? "draft" : match.status === "finished" ? "green" : "live"} className={match.status === "live" ? "animate-pulse" : ""}>{match.status === "halftime" ? "Halftime" : match.status === "scheduled" ? "Scheduled" : match.status === "finished" ? "Finished" : "LIVE"}</Badge>
            <Badge variant="blue">{match.sport}</Badge>
            <Badge variant="gold" className="text-caption">{match.competitionName}</Badge>
            {(match.sourceType === "api" || match.sourceType === "hybrid") && <Badge variant="purple">API</Badge>}
            {!match.isPublished && <Badge variant="draft">Draft</Badge>}
          </div>
          <div className="flex items-center justify-between">
            <div className="flex-1 text-center"><p className="text-h3 text-text-primary">{match.homeTeamName}</p></div>
            <div className="flex items-center gap-4 shrink-0 px-4">
              {canWrite ? (<><button onClick={() => quickUpdate(match, "homeScore", (match.homeScore ?? 0) - 1)} className="rounded-md p-1 text-text-tertiary hover:bg-bg-tertiary hover:text-text-primary"><Minus className="h-5 w-5" /></button><div className="text-center"><p className="text-h1 font-bold tabular-nums tracking-tight text-accent-gold">{match.homeScore ?? 0} : {match.awayScore ?? 0}</p><p className="text-caption text-text-tertiary">{formatMinute(match)}</p></div><button onClick={() => quickUpdate(match, "awayScore", (match.awayScore ?? 0) + 1)} className="rounded-md p-1 text-text-tertiary hover:bg-bg-tertiary hover:text-text-primary"><Plus className="h-5 w-5" /></button></>) : (<div className="text-center"><p className="text-h1 font-bold tabular-nums tracking-tight text-accent-gold">{match.homeScore ?? 0} : {match.awayScore ?? 0}</p><p className="text-caption text-text-tertiary">{formatMinute(match)}</p></div>)}
            </div>
            <div className="flex-1 text-center"><p className="text-h3 text-text-primary">{match.awayTeamName}</p></div>
          </div>
          {canWrite && (<div className="flex flex-wrap items-center gap-3 border-t border-border-muted pt-3">
            <div className="flex items-center gap-1"><span className="text-caption text-text-disabled">Min:</span><button onClick={() => quickUpdate(match, "currentMinute", (match.currentMinute ?? 0) - 1)} className="rounded p-0.5 text-text-tertiary hover:text-text-primary"><Minus className="h-3.5 w-3.5" /></button><span className="w-8 text-center text-body-sm tabular-nums text-text-primary">{match.currentMinute ?? 0}</span><button onClick={() => quickUpdate(match, "currentMinute", (match.currentMinute ?? 0) + 1)} className="rounded p-0.5 text-text-tertiary hover:text-text-primary"><Plus className="h-3.5 w-3.5" /></button></div>
            <div className="flex items-center gap-1"><span className="text-caption text-text-disabled">H:</span><button onClick={() => quickUpdate(match, "homeScore", (match.homeScore ?? 0) - 1)} className="rounded p-0.5 text-text-tertiary hover:text-text-primary"><Minus className="h-3.5 w-3.5" /></button><span className="w-6 text-center text-body-sm tabular-nums text-text-primary">{match.homeScore ?? 0}</span><button onClick={() => quickUpdate(match, "homeScore", (match.homeScore ?? 0) + 1)} className="rounded p-0.5 text-text-tertiary hover:text-text-primary"><Plus className="h-3.5 w-3.5" /></button></div>
            <div className="flex items-center gap-1"><span className="text-caption text-text-disabled">A:</span><button onClick={() => quickUpdate(match, "awayScore", (match.awayScore ?? 0) - 1)} className="rounded p-0.5 text-text-tertiary hover:text-text-primary"><Minus className="h-3.5 w-3.5" /></button><span className="w-6 text-center text-body-sm tabular-nums text-text-primary">{match.awayScore ?? 0}</span><button onClick={() => quickUpdate(match, "awayScore", (match.awayScore ?? 0) + 1)} className="rounded p-0.5 text-text-tertiary hover:text-text-primary"><Plus className="h-3.5 w-3.5" /></button></div>
            <div className="flex items-center gap-1.5 ml-auto">
              <button onClick={() => updateStatus(match, "live")} className={cn("rounded-md px-2 py-1 text-caption", match.status === "live" ? "bg-accent-red/15 text-accent-red" : "text-text-tertiary hover:bg-bg-tertiary")}>Live</button>
              <button onClick={() => updateStatus(match, "halftime")} className={cn("rounded-md px-2 py-1 text-caption", match.status === "halftime" ? "bg-accent-orange/15 text-accent-orange" : "text-text-tertiary hover:bg-bg-tertiary")}>HT</button>
              <button onClick={() => updateStatus(match, "finished")} className="rounded-md px-2 py-1 text-caption text-text-tertiary transition-colors hover:bg-accent-green/15 hover:text-accent-green">FT</button>
              <button onClick={() => updateStatus(match, "postponed")} className="rounded-md px-2 py-1 text-caption text-text-tertiary transition-colors hover:bg-bg-tertiary">Ppd</button>
            </div>
            <Switch checked={match.enableWatchMode} onCheckedChange={(v) => updateMatchField(match.id, { enableWatchMode: v })} label="Watch" className="ml-2" />
            <button onClick={() => { setEditingStream(match); setNewStreamUrl(match.streamUrl ?? ""); }} className="rounded-md p-1 text-text-tertiary hover:bg-bg-tertiary hover:text-accent-blue" title="Edit stream URL"><ExternalLink className="h-4 w-4" /></button>
            <button className="rounded-md p-1 text-text-tertiary hover:bg-bg-tertiary hover:text-accent-gold" title="Send notification"><Bell className="h-4 w-4" /></button>
            {(match.stadium || match.venueDisplayText) && (<span className="text-caption text-text-disabled ml-auto">{match.venueDisplayText || match.stadium}</span>)}
          </div>)}
        </CardContent>
      </Card>
    );
  }
}
