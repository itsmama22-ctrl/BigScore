"use client";

import { useEffect, useState, useCallback } from "react";
import { getDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/hooks/useAuth";
import { createTeamAction, updateTeamAction, deleteTeamAction } from "@/app/actions/teams";
import { syncTeamsAction } from "@/app/actions/syncManagement";
import { searchTeamsAction } from "@/app/actions/search";
import { ApiSearchInput } from "@/components/forms/ApiSearchInput";
import { queryWithFallback } from "@/lib/queryWithFallback";
import { type TeamFormValues } from "@/lib/validation/teamSchema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Modal } from "@/components/ui/modal";
import { Card, CardContent } from "@/components/ui/card";
import { ImageUpload } from "@/components/forms/ImageUpload";
import { cn } from "@/lib/utils";
import { Plus, Search, Edit, Trash2, Shield, X, Sparkles, RefreshCw, Loader2 } from "lucide-react";

interface Team { id: string; name: string; shortName?: string; logoUrl?: string; country: string; sport: string; isActive: boolean }

export default function TeamsPage() {
  const { adminProfile } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sportFilter, setSportFilter] = useState("all");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Team | null>(null);
  const [form, setForm] = useState<TeamFormValues>({ name: "", shortName: "", logoUrl: "", country: "", sport: "Football", isActive: true });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<Team | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [syncing, setSyncing] = useState(false);

  const [lastSync, setLastSync] = useState<{ teamsLastSyncAt?: { seconds: number }; teamsLastResult?: { created?: number; updated?: number } } | null>(null);

  useEffect(() => {
    queryWithFallback({ collection: "appSettings", docId: "syncStatus" }).then((data) => {
      if (data.length > 0) setLastSync(data[0] as typeof lastSync);
    }).catch(() => {});
  }, []);

  async function handleSync() {
    setSyncing(true);
    try {
      await syncTeamsAction({ actor: { uid: adminProfile!.uid, email: adminProfile!.email, role: adminProfile!.role } });
      const data = await queryWithFallback({ collection: "appSettings", docId: "syncStatus" });
      if (data.length > 0) setLastSync(data[0] as typeof lastSync);
    } catch (e) { console.error("[sync]", e); }
    finally { setSyncing(false); }
  }

  const canWrite = adminProfile?.role === "super_admin" || adminProfile?.role === "content_manager";

  const loadTeams = useCallback(async () => {
    setLoading(true);
    try {
      const data = await queryWithFallback<Team>({
        collection: "teams",
        orderByField: "createdAt",
        orderByDir: "desc",
      });
      setTeams(data);
    } catch (e) {
      console.error("[teams]", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadTeams(); }, [loadTeams]);

  function openCreate() { setEditing(null); setForm({ name: "", shortName: "", logoUrl: "", country: "", sport: "Football", isActive: true }); setFormError(null); setModalOpen(true); }
  function openEdit(t: Team) { setEditing(t); setForm({ name: t.name, shortName: t.shortName ?? "", logoUrl: t.logoUrl ?? "", country: t.country, sport: t.sport, isActive: t.isActive }); setFormError(null); setModalOpen(true); }

  async function handleSave() {
    if (!adminProfile) return;
    setSaving(true); setFormError(null);
    const actor = { uid: adminProfile.uid, email: adminProfile.email, role: adminProfile.role };
    const result = editing
      ? await updateTeamAction({ teamId: editing.id, data: form, actor })
      : await createTeamAction({ data: form, actor });
    setSaving(false);
    if (result.success) { setModalOpen(false); } else { setFormError(result.error ?? "Failed."); }
  }

  async function handleDelete() {
    if (!deleteTarget || !adminProfile) return;
    setDeleting(true);
    const result = await deleteTeamAction({ teamId: deleteTarget.id, actor: { uid: adminProfile.uid, email: adminProfile.email, role: adminProfile.role } });
    setDeleting(false);
    if (result.success) { setTeams((p) => p.filter((t) => t.id !== deleteTarget.id)); setDeleteTarget(null); }
  }

  const sports = Array.from(new Set(teams.map((t) => t.sport))).sort();
  const filtered = teams.filter((t) => {
    if (search && !t.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (sportFilter !== "all" && t.sport !== sportFilter) return false;
    return true;
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div><h1 className="text-h2 text-text-primary">Teams</h1><p className="text-body text-text-tertiary">Manage teams and clubs</p></div>
        <div className="flex items-center gap-2">
          {lastSync?.teamsLastSyncAt && (
            <span className="text-caption text-text-tertiary whitespace-nowrap">
              Last sync: {new Date(lastSync.teamsLastSyncAt.seconds * 1000).toLocaleString()}
              {lastSync.teamsLastResult && ` (${lastSync.teamsLastResult.created ?? 0} created, ${lastSync.teamsLastResult.updated ?? 0} updated)`}
            </span>
          )}
          <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing}>
            {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {syncing ? "Syncing..." : "Sync"}
          </Button>
          {canWrite && <Button variant="primary" onClick={openCreate}><Plus className="h-4 w-4" /> Add Team</Button>}
        </div>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
            <input type="text" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full rounded-lg border border-border-default bg-bg-tertiary py-2.5 pl-10 pr-4 text-body text-text-primary placeholder:text-text-disabled focus:border-border-focus focus:outline-none" />
          </div>
          <select value={sportFilter} onChange={(e) => setSportFilter(e.target.value)} className="rounded-lg border border-border-default bg-bg-tertiary px-3 py-2.5 text-body-sm text-text-primary focus:border-border-focus focus:outline-none">
            <option value="all">All Sports</option>
            {sports.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          {(search || sportFilter !== "all") && <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setSportFilter("all"); }}><X className="h-4 w-4" /> Clear</Button>}
        </CardContent>
      </Card>

      {loading && <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-14 animate-pulse rounded-lg bg-bg-secondary" />)}</div>}

      {!loading && filtered.length === 0 && (
        <Card><CardContent className="flex flex-col items-center gap-4 py-16"><Shield className="h-10 w-10 text-text-disabled" /><p className="text-body text-text-tertiary">No teams found.</p></CardContent></Card>
      )}

      {!loading && filtered.length > 0 && (
        <Card><CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="border-b border-border-muted bg-bg-tertiary"><th className="px-4 py-3 text-left text-label text-text-tertiary">Name</th><th className="px-4 py-3 text-left text-label text-text-tertiary">Short</th><th className="px-4 py-3 text-left text-label text-text-tertiary">Country</th><th className="px-4 py-3 text-left text-label text-text-tertiary">Sport</th><th className="px-4 py-3 text-left text-label text-text-tertiary">Status</th>{canWrite && <th className="px-4 py-3 text-right text-label text-text-tertiary">Actions</th>}</tr></thead>
              <tbody>
                {filtered.map((t, i) => (
                  <tr key={t.id} className={cn("transition-colors hover:bg-bg-tertiary/50", i !== filtered.length - 1 && "border-b border-border-muted")}>
                    <td className="px-4 py-3 text-body-sm text-text-primary font-medium">{t.name}</td>
                    <td className="px-4 py-3 text-body-sm text-text-tertiary">{t.shortName || "--"}</td>
                    <td className="px-4 py-3 text-body-sm text-text-secondary">{t.country}</td>
                    <td className="px-4 py-3"><Badge variant="blue">{t.sport}</Badge></td>
                    <td className="px-4 py-3"><Badge variant={t.isActive ? "green" : "disabled"}>{t.isActive ? "Active" : "Inactive"}</Badge></td>
                    {canWrite && (
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openEdit(t)} className="rounded-md p-1.5 text-text-tertiary hover:bg-bg-tertiary hover:text-accent-blue" title="Edit"><Edit className="h-4 w-4" /></button>
                          <button onClick={() => setDeleteTarget(t)} className="rounded-md p-1.5 text-text-tertiary hover:bg-bg-tertiary hover:text-accent-red" title="Delete"><Trash2 className="h-4 w-4" /></button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent></Card>
      )}

      {/* Form Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit Team" : "Add Team"} size="md">
        <div className="flex flex-col gap-4">
          {!editing && (
            <>
              <div className="flex items-center gap-2 text-body-sm text-text-tertiary">
                <Sparkles className="h-4 w-4 text-accent-gold" />
                <span>Search from external APIs to pre-fill fields</span>
              </div>
              <ApiSearchInput
                label="API Search"
                placeholder="Search teams (e.g. Arsenal)..."
                onSelect={(result) => {
                  setForm({
                    ...form,
                    name: result.name,
                    shortName: result.shortName ?? "",
                    country: result.country ?? "",
                    sport: result.sport ?? "Football",
                    logoUrl: result.logoUrl ?? "",
                  });
                }}
                onSearch={async (query) => {
                  const res = await searchTeamsAction({ query, actorRole: adminProfile?.role ?? "" });
                  return res;
                }}
              />
              <div className="flex items-center gap-3 py-1">
                <div className="flex-1 border-t border-border-muted" />
                <span className="text-caption text-text-disabled">or enter manually</span>
                <div className="flex-1 border-t border-border-muted" />
              </div>
            </>
          )}
          <Input label="Name" placeholder="Team name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input label="Short Name" placeholder="3-5 letters" value={form.shortName ?? ""} onChange={(e) => setForm({ ...form, shortName: e.target.value })} maxLength={10} />
          <Input label="Country" placeholder="Country" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
          <Input label="Sport" placeholder="e.g. Football" value={form.sport} onChange={(e) => setForm({ ...form, sport: e.target.value })} />
          <ImageUpload value={form.logoUrl ?? ""} onChange={(v) => setForm({ ...form, logoUrl: v })} path="teams" aspectRatio="aspect-[1/1]" label="Team Logo (1:1)" />
          <Switch checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} label="Active" />
          {formError && <p className="text-caption text-accent-red">{formError}</p>}
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setModalOpen(false)} disabled={saving}>Cancel</Button>
            <Button variant="primary" loading={saving} onClick={handleSave}>{editing ? "Update" : "Create"}</Button>
          </div>
        </div>
      </Modal>

      {/* Delete Modal */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Team" variant="danger">
        {deleteTarget && (
          <div className="space-y-4">
            <p className="text-body text-text-secondary">Delete &quot;{deleteTarget.name}&quot;?</p>
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancel</Button>
              <Button variant="danger" loading={deleting} onClick={handleDelete}>Delete</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
