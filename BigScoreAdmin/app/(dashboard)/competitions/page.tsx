"use client";

import { useEffect, useState, useCallback } from "react";
import { getDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/hooks/useAuth";
import { createCompetitionAction, updateCompetitionAction, deleteCompetitionAction } from "@/app/actions/competitions";
import { syncCompetitionsAction } from "@/app/actions/syncManagement";
import { searchCompetitionsAction } from "@/app/actions/search";
import { ApiSearchInput } from "@/components/forms/ApiSearchInput";
import { queryWithFallback } from "@/lib/queryWithFallback";
import { sports, type CompetitionFormValues } from "@/lib/validation/competitionSchema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Modal } from "@/components/ui/modal";
import { Card, CardContent } from "@/components/ui/card";
import { ImageUpload } from "@/components/forms/ImageUpload";
import { cn } from "@/lib/utils";
import { Plus, Search, Edit, Trash2, Trophy, X, Sparkles, RefreshCw, Loader2 } from "lucide-react";

interface Comp { id: string; name: string; country: string; sport: string; teamType: "club" | "national" | "mixed"; logoUrl?: string; isActive: boolean; displayOrder: number }

export default function CompetitionsPage() {
  const { adminProfile } = useAuth();
  const [comps, setComps] = useState<Comp[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sportFilter, setSportFilter] = useState("all");

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Comp | null>(null);
  const [form, setForm] = useState<CompetitionFormValues>({ name: "", country: "", sport: "Football", teamType: "club", logoUrl: "", isActive: true, displayOrder: 0 });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<Comp | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [syncing, setSyncing] = useState(false);

  const [lastSync, setLastSync] = useState<{ competitionsLastSyncAt?: { seconds: number }; competitionsLastResult?: { created?: number; updated?: number } } | null>(null);

  useEffect(() => {
    queryWithFallback({ collection: "appSettings", docId: "syncStatus" }).then((data) => {
      if (data.length > 0) setLastSync(data[0] as typeof lastSync);
    }).catch(() => {});
  }, []);

  async function handleSync() {
    setSyncing(true);
    try {
      await syncCompetitionsAction({ actor: { uid: adminProfile!.uid, email: adminProfile!.email, role: adminProfile!.role } });
      const data = await queryWithFallback({ collection: "appSettings", docId: "syncStatus" });
      if (data.length > 0) setLastSync(data[0] as typeof lastSync);
    } catch (e) { console.error("[sync]", e); }
    finally { setSyncing(false); }
  }

  const canWrite = adminProfile?.role === "super_admin" || adminProfile?.role === "content_manager";

  const loadComps = useCallback(async () => {
    setLoading(true);
    try {
      const data = await queryWithFallback<Comp>({
        collection: "competitions",
        orderByField: "createdAt",
        orderByDir: "desc",
      });
      setComps(data);
    } catch (e) {
      console.error("[competitions]", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadComps(); }, [loadComps]);

  function openCreate() { setEditing(null); setForm({ name: "", country: "", sport: "Football", teamType: "club", logoUrl: "", isActive: true, displayOrder: 0 }); setFormError(null); setModalOpen(true); }
  function openEdit(c: Comp) { setEditing(c); setForm({ name: c.name, country: c.country, sport: c.sport as CompetitionFormValues["sport"], teamType: c.teamType, logoUrl: c.logoUrl ?? "", isActive: c.isActive, displayOrder: c.displayOrder }); setFormError(null); setModalOpen(true); }

  async function handleSave() {
    if (!adminProfile) return;
    setSaving(true); setFormError(null);
    const actor = { uid: adminProfile.uid, email: adminProfile.email, role: adminProfile.role };
    const result = editing
      ? await updateCompetitionAction({ compId: editing.id, data: form, actor })
      : await createCompetitionAction({ data: form, actor });
    setSaving(false);
    if (result.success) { setModalOpen(false); } else { setFormError(result.error ?? "Failed."); }
  }

  async function handleDelete() {
    if (!deleteTarget || !adminProfile) return;
    setDeleting(true);
    const result = await deleteCompetitionAction({ compId: deleteTarget.id, actor: { uid: adminProfile.uid, email: adminProfile.email, role: adminProfile.role } });
    setDeleting(false);
    if (result.success) { setComps((p) => p.filter((c) => c.id !== deleteTarget.id)); setDeleteTarget(null); }
  }

  const filtered = comps.filter((c) => {
    if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (sportFilter !== "all" && c.sport !== sportFilter) return false;
    return true;
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div><h1 className="text-h2 text-text-primary">Competitions</h1><p className="text-body text-text-tertiary">Manage leagues and competitions</p></div>
        <div className="flex items-center gap-2">
          {lastSync?.competitionsLastSyncAt && (
            <span className="text-caption text-text-tertiary whitespace-nowrap">
              Last sync: {new Date(lastSync.competitionsLastSyncAt.seconds * 1000).toLocaleString()}
              {lastSync.competitionsLastResult && ` (${lastSync.competitionsLastResult.created ?? 0} created, ${lastSync.competitionsLastResult.updated ?? 0} updated)`}
            </span>
          )}
          <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing}>
            {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {syncing ? "Syncing..." : "Sync"}
          </Button>
          {canWrite && <Button variant="primary" onClick={openCreate}><Plus className="h-4 w-4" /> Add Competition</Button>}
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
        <Card><CardContent className="flex flex-col items-center gap-4 py-16"><Trophy className="h-10 w-10 text-text-disabled" /><p className="text-body text-text-tertiary">No competitions found.</p></CardContent></Card>
      )}

      {!loading && filtered.length > 0 && (
        <Card><CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="border-b border-border-muted bg-bg-tertiary"><th className="px-4 py-3 text-left text-label text-text-tertiary">Name</th><th className="px-4 py-3 text-left text-label text-text-tertiary">Country</th><th className="px-4 py-3 text-left text-label text-text-tertiary">Sport</th><th className="px-4 py-3 text-left text-label text-text-tertiary">Status</th><th className="px-4 py-3 text-left text-label text-text-tertiary">Order</th>{canWrite && <th className="px-4 py-3 text-right text-label text-text-tertiary">Actions</th>}</tr></thead>
              <tbody>
                {filtered.map((c, i) => (
                  <tr key={c.id} className={cn("transition-colors hover:bg-bg-tertiary/50", i !== filtered.length - 1 && "border-b border-border-muted")}>
                    <td className="px-4 py-3 text-body-sm text-text-primary font-medium">{c.name}</td>
                    <td className="px-4 py-3 text-body-sm text-text-secondary">{c.country}</td>
                    <td className="px-4 py-3"><Badge variant="blue">{c.sport}</Badge></td>
                    <td className="px-4 py-3"><Badge variant={c.isActive ? "green" : "disabled"}>{c.isActive ? "Active" : "Inactive"}</Badge></td>
                    <td className="px-4 py-3 text-body-sm text-text-tertiary">{c.displayOrder}</td>
                    {canWrite && (
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openEdit(c)} className="rounded-md p-1.5 text-text-tertiary hover:bg-bg-tertiary hover:text-accent-blue" title="Edit"><Edit className="h-4 w-4" /></button>
                          <button onClick={() => setDeleteTarget(c)} className="rounded-md p-1.5 text-text-tertiary hover:bg-bg-tertiary hover:text-accent-red" title="Delete"><Trash2 className="h-4 w-4" /></button>
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
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit Competition" : "Add Competition"} size="md">
        <div className="flex flex-col gap-4">
          {!editing && (
            <>
              <div className="flex items-center gap-2 text-body-sm text-text-tertiary">
                <Sparkles className="h-4 w-4 text-accent-gold" />
                <span>Search from external APIs to pre-fill fields</span>
              </div>
              <ApiSearchInput
                label="API Search"
                placeholder="Search competitions (e.g. Premier League)..."
                onSelect={(result) => {
                  setForm({
                    ...form,
                    name: result.name,
                    country: result.country ?? "",
                    sport: (result.sport as CompetitionFormValues["sport"]) ?? "Football",
                    logoUrl: result.logoUrl ?? "",
                  });
                }}
                onSearch={async (query) => {
                  const res = await searchCompetitionsAction({ query, actorRole: adminProfile?.role ?? "" });
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
          <Input label="Name" placeholder="Competition name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input label="Country" placeholder="Country" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
           <div>
             <label className="mb-1.5 block text-label text-text-secondary">Sport</label>
             <select value={form.sport} onChange={(e) => setForm({ ...form, sport: e.target.value as CompetitionFormValues["sport"] })} className="w-full rounded-lg border border-border-default bg-bg-tertiary px-3 py-2.5 text-body text-text-primary focus:border-border-focus focus:outline-none">
               {sports.map((s) => <option key={s} value={s}>{s}</option>)}
             </select>
           </div>
           <div>
             <label className="mb-1.5 block text-label text-text-secondary">Team Type</label>
             <select value={form.teamType} onChange={(e) => setForm({ ...form, teamType: e.target.value as CompetitionFormValues["teamType"] })} className="w-full rounded-lg border border-border-default bg-bg-tertiary px-3 py-2.5 text-body text-text-primary focus:border-border-focus focus:outline-none">
               <option value="club">Club Teams (e.g., Premier League, La Liga)</option>
               <option value="national">National Teams (e.g., FIFA World Cup, Euro)</option>
               <option value="mixed">Mixed / Unsure</option>
             </select>
           </div>
           <Input label="Display Order" type="number" min={0} value={form.displayOrder} onChange={(e) => setForm({ ...form, displayOrder: parseInt(e.target.value) || 0 })} />
          <ImageUpload value={form.logoUrl ?? ""} onChange={(v) => setForm({ ...form, logoUrl: v })} path="competitions" aspectRatio="aspect-[1/1]" label="Logo (1:1)" />
          <div className="flex items-center gap-3">
            <Switch checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} label="Active" />
          </div>
          {formError && <p className="text-caption text-accent-red">{formError}</p>}
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setModalOpen(false)} disabled={saving}>Cancel</Button>
            <Button variant="primary" loading={saving} onClick={handleSave}>{editing ? "Update" : "Create"}</Button>
          </div>
        </div>
      </Modal>

      {/* Delete Modal */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Competition" variant="danger">
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
