"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import {
  collection,
  query,
  orderBy,
  getDocs,
  doc,
  getDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { queryWithFallback } from "@/lib/queryWithFallback";
import { useAuth } from "@/hooks/useAuth";
import {
  deleteNewsAction,
  updateNewsAction,
} from "@/app/actions/news";
import { fetchNewsFromApiAction, importNewsArticlesAction } from "@/app/actions/newsImport";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { NewsFormValues } from "@/lib/validation/newsSchema";
import { newsCategories } from "@/lib/validation/newsSchema";
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  Star,
  Newspaper,
  X,
  Globe,
  CheckSquare,
  Check,
} from "lucide-react";

interface Article {
  id: string;
  title: string;
  summary?: string;
  body: string;
  imageUrl?: string;
  category: string;
  sourceName?: string;
  sourceUrl?: string;
  sourceType: string;
  isPublished: boolean;
  isFeatured: boolean;
  publishedAt?: { seconds: number };
  createdAt?: { seconds: number };
}

export default function NewsPage() {
  const router = useRouter();
  const { adminProfile } = useAuth();

  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sourceTypeFilter, setSourceTypeFilter] = useState("all");

  const [deleteTarget, setDeleteTarget] = useState<Article | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());

  // Import state
  const [importOpen, setImportOpen] = useState(false);
  const [importArticles, setImportArticles] = useState<Array<{
    id: string; externalId: string; title: string; summary?: string; body: string; imageUrl?: string; category: string; sourceName: string; sourceUrl?: string; publishedAt: string; existsInDb: boolean; duplicateOf?: string;
  }>>([]);
  const [importLoading, setImportLoading] = useState(false);
  const [importSelected, setImportSelected] = useState<Set<string>>(new Set());
  const [importSaving, setImportSaving] = useState(false);
  const [importResult, setImportResult] = useState<{ imported?: number; skipped?: number; errors?: string[] } | null>(null);
  const [lastSync, setLastSync] = useState<{ lastSyncAt?: { seconds: number }; lastSyncStatus?: string; lastSyncResult?: { created?: number; updated?: number } } | null>(null);

  useEffect(() => {
    queryWithFallback({ collection: "appSettings", docId: "newsApi" }).then((data) => {
      if (data.length > 0) setLastSync(data[0] as typeof lastSync);
    }).catch(() => {});
  }, []);
  
  const canWrite =
    adminProfile?.role === "super_admin" ||
    adminProfile?.role === "content_manager";

  const loadArticles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await Promise.race([
        (async () => {
          try {
            const q = query(collection(db, "news"), orderBy("createdAt", "desc"));
            const snap = await getDocs(q);
            const items: Article[] = [];
            snap.forEach((d) => {
              const data = d.data();
              items.push({
                id: d.id,
                title: data.title ?? "",
                summary: data.summary,
                body: data.body ?? "",
                imageUrl: data.imageUrl,
                category: data.category ?? "Other",
                sourceName: data.sourceName,
                sourceUrl: data.sourceUrl,
                sourceType: data.sourceType ?? "manual",
                isPublished: data.isPublished ?? false,
                isFeatured: data.isFeatured ?? false,
                publishedAt: data.publishedAt,
                createdAt: data.createdAt,
              });
            });
            return items;
          } catch {
            return "__timeout__" as const;
          }
        })(),
        new Promise<string>((resolve) =>
          setTimeout(() => resolve("__timeout__"), 4000)
        ),
      ]);

      if (list === "__timeout__") {
        const fallback = await queryWithFallback<Article>({
          collection: "news",
          orderByField: "createdAt",
          orderByDir: "desc",
        });
        setArticles(fallback);
      } else {
        setArticles(list as Article[]);
      }
    } catch (err) {
      console.error("[news]", err);
      setError("Failed to load articles.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadArticles();
  }, [loadArticles]);

  async function handleTogglePublish(article: Article) {
    if (!adminProfile) return;
    setBusyIds((prev) => new Set(prev).add(article.id));

    const result = await updateNewsAction({
      articleId: article.id,
      data: { ...article, isPublished: !article.isPublished } as unknown as NewsFormValues,
      actor: { uid: adminProfile.uid, email: adminProfile.email, role: adminProfile.role },
    });

    setBusyIds((prev) => {
      const n = new Set(prev);
      n.delete(article.id);
      return n;
    });

    if (result.success) {
      setArticles((prev) =>
        prev.map((a) =>
          a.id === article.id ? { ...a, isPublished: !article.isPublished } : a
        )
      );
    }
  }

  async function handleToggleFeatured(article: Article) {
    if (!adminProfile) return;
    setBusyIds((prev) => new Set(prev).add(article.id));

    const result = await updateNewsAction({
      articleId: article.id,
      data: { ...article, isFeatured: !article.isFeatured } as unknown as NewsFormValues,
      actor: { uid: adminProfile.uid, email: adminProfile.email, role: adminProfile.role },
    });

    setBusyIds((prev) => {
      const n = new Set(prev);
      n.delete(article.id);
      return n;
    });

    if (result.success) {
      setArticles((prev) =>
        prev.map((a) =>
          a.id === article.id ? { ...a, isFeatured: !article.isFeatured } : a
        )
      );
    }
  }

  async function handleDelete() {
    if (!deleteTarget || !adminProfile) return;
    setDeleting(true);
    setActionError(null);

    const result = await deleteNewsAction({
      articleId: deleteTarget.id,
      actor: { uid: adminProfile.uid, email: adminProfile.email, role: adminProfile.role },
    });

    setDeleting(false);
    if (result.success) {
      setArticles((prev) => prev.filter((a) => a.id !== deleteTarget.id));
      setDeleteTarget(null);
    } else {
      setActionError(result.error ?? "Failed to delete article.");
    }
  }

  async function handleFetchNews() {
    if (!adminProfile) return;
    setImportOpen(true);
    setImportLoading(true);
    setImportArticles([]);
    setImportSelected(new Set());
    setImportResult(null);

    const result = await fetchNewsFromApiAction({
      actor: { uid: adminProfile.uid, email: adminProfile.email, role: adminProfile.role },
    });

    setImportLoading(false);

    if (result.success) {
      setImportArticles(result.articles);
      setImportSelected(new Set(result.articles.filter((a) => !a.existsInDb).map((a) => a.id)));
    }
  }

  function toggleImportSelect(id: string) {
    setImportSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    const selectable = importArticles.filter((a) => !a.existsInDb);
    if (importSelected.size === selectable.length) {
      setImportSelected(new Set());
    } else {
      setImportSelected(new Set(selectable.map((a) => a.id)));
    }
  }

  async function handleImportSelected() {
    if (!adminProfile || importSelected.size === 0) return;
    setImportSaving(true);

    const selected = importArticles.filter((a) => importSelected.has(a.id));

    const result = await importNewsArticlesAction({
      articles: selected,
      actor: { uid: adminProfile.uid, email: adminProfile.email, role: adminProfile.role },
    });

    setImportSaving(false);
    setImportResult({ imported: result.imported, skipped: result.skipped, errors: result.errors });

    if (result.imported > 0) {
      loadArticles();
      getDoc(doc(db, "appSettings", "newsApi")).then((snap) => {
        if (snap.exists()) setLastSync(snap.data() as typeof lastSync);
      }).catch(() => {});
    }
  }

  const filtered = articles.filter((a) => {
    if (search && !a.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (categoryFilter !== "all" && a.category !== categoryFilter) return false;
    if (statusFilter === "published" && !a.isPublished) return false;
    if (statusFilter === "draft" && a.isPublished) return false;
    if (sourceTypeFilter !== "all" && a.sourceType !== sourceTypeFilter) return false;
    return true;
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-h2 text-text-primary">News</h1>
          <p className="text-body text-text-tertiary">Manage articles and news content</p>
        </div>
        {canWrite && (
          <div className="flex items-center gap-2 shrink-0">
            {lastSync?.lastSyncAt && (
              <span className="text-caption text-text-tertiary whitespace-nowrap">
                Last sync: {new Date(lastSync.lastSyncAt.seconds * 1000).toLocaleString()}
                {lastSync.lastSyncResult && ` (${lastSync.lastSyncResult.created ?? 0} created, ${lastSync.lastSyncResult.updated ?? 0} updated)`}
              </span>
            )}
            <Button variant="outline" onClick={handleFetchNews} disabled={importLoading}>
              <Globe className="h-4 w-4" /> Fetch Latest News
            </Button>
            <Button variant="primary" onClick={() => router.push("/news/new")}>
              <Plus className="h-4 w-4" /> Add Article
            </Button>
          </div>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
            <input
              type="text"
              placeholder="Search by title..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-border-default bg-bg-tertiary py-2.5 pl-10 pr-4 text-body text-text-primary placeholder:text-text-disabled focus:border-border-focus focus:outline-none"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded-lg border border-border-default bg-bg-tertiary px-3 py-2.5 text-body-sm text-text-primary focus:border-border-focus focus:outline-none"
          >
            <option value="all">All Categories</option>
            {newsCategories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-border-default bg-bg-tertiary px-3 py-2.5 text-body-sm text-text-primary focus:border-border-focus focus:outline-none"
          >
            <option value="all">All Status</option>
            <option value="published">Published</option>
            <option value="draft">Drafts</option>
          </select>
          <select
            value={sourceTypeFilter}
            onChange={(e) => setSourceTypeFilter(e.target.value)}
            className="rounded-lg border border-border-default bg-bg-tertiary px-3 py-2.5 text-body-sm text-text-primary focus:border-border-focus focus:outline-none"
          >
            <option value="all">All Sources</option>
            <option value="manual">Manual</option>
            <option value="api">API</option>
          </select>
          {(search || categoryFilter !== "all" || statusFilter !== "all" || sourceTypeFilter !== "all") && (
            <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setCategoryFilter("all"); setStatusFilter("all"); setSourceTypeFilter("all"); }}>
              <X className="h-4 w-4" /> Clear
            </Button>
          )}
        </CardContent>
      </Card>

      {error && (
        <Card className="border-border-error">
          <CardContent className="flex items-center justify-between p-4">
            <p className="text-body text-accent-red">{error}</p>
            <Button variant="ghost" size="sm" onClick={loadArticles}>Retry</Button>
          </CardContent>
        </Card>
      )}

      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-lg bg-bg-secondary" />
          ))}
        </div>
      )}

      {!loading && filtered.length === 0 && !error && (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-16">
            <Newspaper className="h-10 w-10 text-text-disabled" />
            <p className="text-body text-text-tertiary">
              {search || categoryFilter !== "all" || statusFilter !== "all"
                ? "No articles match your filters."
                : "No articles yet."}
            </p>
          </CardContent>
        </Card>
      )}

      {!loading && filtered.length > 0 && (
        <div className="flex flex-col gap-3">
          {filtered.map((article) => (
            <Card key={article.id} className="transition-shadow hover:shadow-md">
              <CardContent className="flex items-start gap-4 p-4">
                {article.imageUrl && (
                  <div className="hidden h-20 w-32 shrink-0 overflow-hidden rounded-lg bg-bg-tertiary sm:block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={article.imageUrl} alt="" className="h-full w-full object-cover" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start gap-2">
                    <h3 className="text-body font-semibold text-text-primary line-clamp-1">
                      {article.title}
                    </h3>
                    <div className="flex shrink-0 items-center gap-1">
                      {article.isFeatured && <Badge variant="gold"><Star className="h-3 w-3" /></Badge>}
                      <Badge variant={article.isPublished ? "green" : "draft"}>
                        {article.isPublished ? "Published" : "Draft"}
                      </Badge>
                      <Badge variant="blue">{article.category}</Badge>
                      {article.sourceType === "api" && <Badge variant="purple">API</Badge>}
                    </div>
                  </div>
                  {article.summary && (
                    <p className="mt-1 text-body-sm text-text-tertiary line-clamp-2">{article.summary}</p>
                  )}
                  {article.sourceName && (
                    <p className="mt-1 text-caption text-text-disabled">Source: {article.sourceName}</p>
                  )}
                  {canWrite && (
                    <div className="mt-2 flex items-center gap-1">
                      <button
                        onClick={() => router.push(`/news/${article.id}/edit`)}
                        className="rounded-md p-1 text-text-tertiary hover:bg-bg-tertiary hover:text-accent-blue"
                        title="Edit"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleTogglePublish(article)}
                        disabled={busyIds.has(article.id)}
                        className="rounded-md p-1 text-text-tertiary hover:bg-bg-tertiary hover:text-accent-green"
                        title={article.isPublished ? "Unpublish" : "Publish"}
                      >
                        {article.isPublished ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                      <button
                        onClick={() => handleToggleFeatured(article)}
                        disabled={busyIds.has(article.id)}
                        className={cn(
                          "rounded-md p-1 transition-colors",
                          article.isFeatured
                            ? "text-accent-gold hover:bg-bg-tertiary"
                            : "text-text-tertiary hover:bg-bg-tertiary hover:text-accent-gold"
                        )}
                        title={article.isFeatured ? "Remove featured" : "Feature"}
                      >
                        <Star className="h-4 w-4" fill={article.isFeatured ? "currentColor" : "none"} />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(article)}
                        className="rounded-md p-1 text-text-tertiary hover:bg-bg-tertiary hover:text-accent-red"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={!!deleteTarget}
        onClose={() => { setDeleteTarget(null); setActionError(null); }}
        title="Delete Article"
        description="This action cannot be undone."
        variant="danger"
      >
        {deleteTarget && (
          <div className="space-y-4">
            <p className="text-body text-text-secondary">Delete &quot;{deleteTarget.title}&quot;?</p>
            {actionError && <p className="text-caption text-accent-red">{actionError}</p>}
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => { setDeleteTarget(null); setActionError(null); }} disabled={deleting}>Cancel</Button>
              <Button variant="danger" loading={deleting} onClick={handleDelete}>Delete</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Import News Modal */}
      <Modal
        open={importOpen}
        onClose={() => { setImportOpen(false); setImportResult(null); }}
        title="Import News from API"
        size="lg"
      >
        <div className="flex flex-col gap-4">
          {importLoading && (
            <div className="flex flex-col items-center gap-3 py-8">
              <Globe className="h-8 w-8 animate-pulse text-accent-blue" />
              <p className="text-body text-text-tertiary">Fetching articles from providers...</p>
            </div>
          )}

          {!importLoading && importResult && (
            <div className="rounded-lg border border-accent-green/30 bg-accent-green/10 p-4">
              <p className="text-body text-text-primary">
                <span className="font-semibold">{importResult.imported}</span> imported,{" "}
                <span className="font-semibold">{importResult.skipped}</span> skipped.
              </p>
              {importResult.errors && importResult.errors.length > 0 && (
                <div className="mt-2 flex flex-col gap-1">
                  {importResult.errors.map((e, i) => (
                    <p key={i} className="text-caption text-accent-red">{e}</p>
                  ))}
                </div>
              )}
            </div>
          )}

          {!importLoading && !importResult && importArticles.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-8">
              <p className="text-body text-text-tertiary">No articles found from configured APIs.</p>
            </div>
          )}

          {!importLoading && !importResult && importArticles.length > 0 && (
            <>
              <div className="flex items-center justify-between">
                <p className="text-body-sm text-text-tertiary">
                  {importArticles.length} articles fetched ({importSelected.size} selected)
                </p>
                <button onClick={toggleSelectAll} className="text-body-sm text-accent-blue hover:underline">
                  {importSelected.size === importArticles.filter((a) => !a.existsInDb).length
                    ? "Deselect All"
                    : "Select All"}
                </button>
              </div>

              <div className="max-h-96 space-y-2 overflow-y-auto">
                {importArticles.map((article) => (
                  <div
                    key={article.id}
                    className={cn(
                      "flex items-start gap-3 rounded-lg border p-3 transition-colors",
                      article.existsInDb
                        ? "border-border-muted opacity-60"
                        : importSelected.has(article.id)
                          ? "border-accent-gold/30 bg-accent-gold/5"
                          : "border-border-muted hover:border-border-default"
                    )}
                  >
                    {!article.existsInDb && (
                      <button
                        onClick={() => toggleImportSelect(article.id)}
                        className={cn(
                          "mt-0.5 shrink-0 rounded",
                          importSelected.has(article.id)
                            ? "text-accent-green"
                            : "text-text-disabled hover:text-text-secondary"
                        )}
                      >
                        {importSelected.has(article.id) ? (
                          <CheckSquare className="h-5 w-5" />
                        ) : (
                          <Check className="h-5 w-5" />
                        )}
                      </button>
                    )}

                    {article.imageUrl && (
                      <div className="hidden h-16 w-24 shrink-0 overflow-hidden rounded bg-bg-tertiary sm:block">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={article.imageUrl} alt="" className="h-full w-full object-cover" />
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="text-body-sm font-semibold text-text-primary line-clamp-1">
                          {article.title}
                        </h4>
                        {article.existsInDb && (
                          <Badge variant="draft" className="shrink-0">Already exists</Badge>
                        )}
                      </div>
                      {article.summary && (
                        <p className="mt-0.5 text-body-sm text-text-tertiary line-clamp-2">
                          {article.summary}
                        </p>
                      )}
                      <div className="mt-1 flex items-center gap-2 text-caption text-text-disabled">
                        <span>{article.sourceName}</span>
                        <span>·</span>
                        <span>{new Date(article.publishedAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-3">
                <Button variant="ghost" onClick={() => { setImportOpen(false); setImportResult(null); }}>
                  Close
                </Button>
                <Button
                  variant="primary"
                  onClick={handleImportSelected}
                  disabled={importSelected.size === 0 || importSaving}
                  loading={importSaving}
                >
                  Import {importSelected.size} Selected
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}
