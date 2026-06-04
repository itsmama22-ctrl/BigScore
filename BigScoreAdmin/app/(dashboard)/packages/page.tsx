"use client";

import { useEffect, useState } from "react";
import {
  collection,
  query,
  orderBy,
  getDocs,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  deletePackageAction,
  createChannelAction,
  updateChannelAction,
  deleteChannelAction,
  updatePackageBasicAction,
  reorderPackagesAction,
  reorderChannelsAction,
} from "@/app/actions/packages";
import { Button } from "@/components/ui/button";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Card, CardContent } from "@/components/ui/card";
import { ImageUpload } from "@/components/forms/ImageUpload";
import {
  Plus,
  Package,
  Edit,
  Eye,
  Trash2,
  Tv,
  X,
  Signal,
  Save,
} from "lucide-react";
import type { ChannelFormValues } from "@/lib/validation/packageSchema";
import type { PackageFormValues } from "@/lib/validation/packageSchema";
import {
  getPackagesAction,
  getChannelsAction,
} from "@/app/actions/packages";

interface PackageData {
  id: string;
  name: string;
  description?: string;
  imageUrl: string;
  category: string;
  isActive: boolean;
  displayOrder: number;
  channelCount: number;
  licenseNotes?: string;
}

interface ChannelData {
  id: string;
  name: string;
  logoUrl?: string;
  streamUrl: string;
  streamUrls?: string[];
  quality: string;
  isActive: boolean;
  displayOrder: number;
}

type RightMode = "edit" | "channels" | null;

const CATEGORIES = ["Football", "Basketball", "Tennis", "Other"] as const;

  function getQualityColor(quality: string): BadgeVariant {
  switch (quality) {
    case "1080p": return "green";
    case "720p": return "blue";
    case "480p": return "disabled";
    default: return "default";
  }
}

export default function PackagesPage() {
  const { adminProfile } = useAuth();

  const [packages, setPackages] = useState<PackageData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredPkgId, setHoveredPkgId] = useState<string | null>(null);
  const [hoveredChanId, setHoveredChanId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PackageData | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [dragItemId, setDragItemId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [chanDragItemId, setChanDragItemId] = useState<string | null>(null);
  const [chanDragOverId, setChanDragOverId] = useState<string | null>(null);

  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);
  const [selectedPkgName, setSelectedPkgName] = useState("");
  const [rightMode, setRightMode] = useState<RightMode>(null);

  const [channels, setChannels] = useState<ChannelData[]>([]);
  const [channelsLoading, setChannelsLoading] = useState(false);

  // Edit form state
  const [editForm, setEditForm] = useState<PackageFormValues>({
    name: "",
    description: "",
    category: "Football",
    isActive: true,
    displayOrder: 0,
    imageUrl: "",
    licenseNotes: "",
  });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [editingChannel, setEditingChannel] = useState<ChannelData | null>(null);
  const [addingChannel, setAddingChannel] = useState(false);
  const [channelEditName, setChannelEditName] = useState("");
  const [channelEditLogo, setChannelEditLogo] = useState("");
  const [channelEditStreamUrls, setChannelEditStreamUrls] = useState<string[]>([""]);
  const [channelEditQuality, setChannelEditQuality] = useState("auto");
  const [channelEditActive, setChannelEditActive] = useState(true);
  const [channelSaving, setChannelSaving] = useState(false);
  const [channelEditError, setChannelEditError] = useState<string | null>(null);

  const [deleteChanTarget, setDeleteChanTarget] = useState<ChannelData | null>(null);
  const [deletingChan, setDeletingChan] = useState(false);

  const canWrite =
    adminProfile?.role === "super_admin" ||
    adminProfile?.role === "content_manager";

  async function loadPackages() {
    setLoading(true);
    setError(null);

    try {
      const data = await Promise.race([
        (async () => {
          const q = query(
            collection(db, "packages"),
            orderBy("displayOrder", "asc")
          );
          const snap = await getDocs(q);
          const list: PackageData[] = [];
          snap.forEach((doc) => {
            const d = doc.data();
            list.push({
              id: doc.id,
              name: d.name ?? doc.id,
              description: d.description,
              imageUrl: d.imageUrl ?? "",
              category: d.category ?? "",
              isActive: d.isActive ?? true,
              displayOrder: d.displayOrder ?? 0,
              channelCount: d.channelCount ?? 0,
              licenseNotes: d.licenseNotes,
            });
          });
          return list;
        })(),
        new Promise<"__timeout__">((resolve) =>
          setTimeout(() => resolve("__timeout__"), 3000)
        ),
      ]);

      if (data === "__timeout__") {
        const fallback = await getPackagesAction();
        fallback.sort((a, b) => a.displayOrder - b.displayOrder);
        if (fallback.length > 0) setPackages(fallback);
        else setError("Failed to load packages.");
        return;
      }

      setPackages(data);
    } catch (err) {
      console.error("[packages]", err);
      setError("Failed to load packages.");
    } finally {
      setLoading(false);
    }
  }

  async function loadChannels(packageId: string) {
    setChannelsLoading(true);
    try {
      const data = await Promise.race([
        (async () => {
          const snap = await getDocs(
            query(
              collection(db, "packages", packageId, "channels"),
              orderBy("displayOrder", "asc")
            )
          );
          const list: ChannelData[] = [];
          snap.forEach((d) => {
            const data = d.data();
            list.push({
              id: d.id,
              name: data.name ?? "",
              logoUrl: data.logoUrl,
              streamUrl: data.streamUrl ?? "",
              streamUrls: data.streamUrls ?? [],
              quality: data.quality ?? "auto",
              isActive: data.isActive ?? true,
              displayOrder: data.displayOrder ?? 0,
            });
          });
          return list;
        })(),
        new Promise<"__timeout__">((resolve) =>
          setTimeout(() => resolve("__timeout__"), 3000)
        ),
      ]);

      if (data === "__timeout__") {
        const fallback = await getChannelsAction(packageId);
        setChannels(fallback);
        return;
      }

      setChannels(data);
    } catch (err) {
      console.error("[loadChannels]", err);
    } finally {
      setChannelsLoading(false);
    }
  }

  useEffect(() => {
    loadPackages();
  }, []);

  useEffect(() => {
    if (selectedPackageId && rightMode === "channels") {
      loadChannels(selectedPackageId);
    } else if (selectedPackageId && rightMode === "edit") {
      const pkg = packages.find((p) => p.id === selectedPackageId);
      if (pkg) {
        setEditForm({
          name: pkg.name,
          description: pkg.description ?? "",
          category: pkg.category as PackageFormValues["category"],
          isActive: pkg.isActive,
          displayOrder: pkg.displayOrder,
          imageUrl: pkg.imageUrl,
          licenseNotes: pkg.licenseNotes ?? "",
        });
      }
    } else {
      setChannels([]);
    }
  }, [selectedPackageId, rightMode]);

  function selectPackage(id: string, name: string, mode: RightMode) {
    setSelectedPackageId(id);
    setSelectedPkgName(name);
    setRightMode(mode);
    setHoveredChanId(null);
  }

  function closePanel() {
    setSelectedPackageId(null);
    setSelectedPkgName("");
    setRightMode(null);
    setEditError(null);
    setChanDragItemId(null);
    setChanDragOverId(null);
    cancelChannelEdit();
  }

  // ─── Package Edit ────────────────────────────────────────────

  async function handleEditSave() {
    if (!selectedPackageId || !adminProfile) return;
    setEditSaving(true);
    setEditError(null);

    const result = await updatePackageBasicAction({
      packageId: selectedPackageId,
      data: editForm,
      actor: {
        uid: adminProfile.uid,
        email: adminProfile.email,
        role: adminProfile.role,
      },
    });

    setEditSaving(false);

    if (result.success) {
      setPackages((prev) =>
        prev.map((p) =>
          p.id === selectedPackageId
            ? { ...p, ...editForm }
            : p
        )
      );
      setSelectedPkgName(editForm.name);
    } else {
      setEditError(result.error ?? "Failed to update package.");
    }
  }

  // ─── Package Delete ──────────────────────────────────────────

  async function handleDeletePackage() {
    if (!deleteTarget || !adminProfile) return;
    setDeleting(true);
    setActionError(null);

    const result = await deletePackageAction({
      packageId: deleteTarget.id,
      actor: {
        uid: adminProfile.uid,
        email: adminProfile.email,
        role: adminProfile.role,
      },
    });

    setDeleting(false);

    if (result.success) {
      setPackages((prev) => prev.filter((p) => p.id !== deleteTarget.id));
      if (selectedPackageId === deleteTarget.id) {
        closePanel();
      }
      setDeleteTarget(null);
    } else {
      setActionError(result.error ?? "Failed to delete package.");
    }
  }

  // ─── Channel CRUD ────────────────────────────────────────────

  function startChannelEdit(chan: ChannelData | null) {
    setAddingChannel(false);
    if (chan) {
      setEditingChannel(chan);
      setChannelEditName(chan.name);
      setChannelEditLogo(chan.logoUrl ?? "");
      setChannelEditStreamUrls(
        chan.streamUrls?.length ? chan.streamUrls : [chan.streamUrl || ""]
      );
      setChannelEditQuality(chan.quality);
      setChannelEditActive(chan.isActive);
    } else {
      setEditingChannel(null);
      setChannelEditName("");
      setChannelEditLogo("");
      setChannelEditStreamUrls([""]);
      setChannelEditQuality("auto");
      setChannelEditActive(true);
    }
    setChannelEditError(null);
  }

  function cancelChannelEdit() {
    setEditingChannel(null);
    setAddingChannel(false);
    setChannelEditError(null);
  }

  function addStreamUrl() {
    setChannelEditStreamUrls((prev) => [...prev, ""]);
  }

  function removeStreamUrl(index: number) {
    setChannelEditStreamUrls((prev) => {
      const next = [...prev];
      next.splice(index, 1);
      return next.length ? next : [""];
    });
  }

  function updateStreamUrl(index: number, value: string) {
    setChannelEditStreamUrls((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }

  function startAddChannel() {
    cancelChannelEdit();
    setAddingChannel(true);
    setChannelEditName("");
    setChannelEditLogo("");
    setChannelEditStreamUrls([""]);
    setChannelEditQuality("auto");
    setChannelEditActive(true);
    setChannelEditError(null);
  }

  async function handleChannelSave() {
    if (!selectedPackageId || !adminProfile) return;
    const validUrls = channelEditStreamUrls.filter((u) => u.trim());
    const streamUrl = validUrls[0] || "";
    if (!streamUrl) {
      setChannelEditError("At least one stream URL is required.");
      return;
    }

    setChannelSaving(true);
    setChannelEditError(null);

    const chData: ChannelFormValues = {
      name: channelEditName || "Unnamed Channel",
      streamUrl,
      quality: channelEditQuality as ChannelFormValues["quality"],
      isActive: channelEditActive,
      displayOrder: editingChannel?.displayOrder ?? channels.length,
      licenseStatus: "pending",
    };

    const actor = {
      uid: adminProfile.uid,
      email: adminProfile.email,
      role: adminProfile.role,
    };

    if (editingChannel) {
      const result = await updateChannelAction({
        packageId: selectedPackageId,
        channelId: editingChannel.id,
        data: chData,
        actor,
      });
      if (result.success) {
        setChannels((prev) =>
          prev.map((c) =>
            c.id === editingChannel.id
              ? {
                  ...chData,
                  id: c.id,
                  logoUrl: channelEditLogo,
                  streamUrls: validUrls,
                }
              : c
          )
        );
        cancelChannelEdit();
      } else {
        setChannelEditError(result.error ?? "Failed to update channel.");
      }
    } else {
      const result = await createChannelAction({
        packageId: selectedPackageId,
        data: chData,
        actor,
      });
      if (result.success) {
        setChannels((prev) => [
          ...prev,
          { ...chData, id: result.id!, logoUrl: channelEditLogo, streamUrls: validUrls },
        ]);
        setPackages((prev) =>
          prev.map((p) =>
            p.id === selectedPackageId
              ? { ...p, channelCount: p.channelCount + 1 }
              : p
          )
        );
        cancelChannelEdit();
      } else {
        setChannelEditError(result.error ?? "Failed to create channel.");
      }
    }

    setChannelSaving(false);
  }

  async function handleDeleteChannel() {
    if (!deleteChanTarget || !selectedPackageId || !adminProfile) return;
    setDeletingChan(true);

    const result = await deleteChannelAction({
      packageId: selectedPackageId,
      channelId: deleteChanTarget.id,
      channelName: deleteChanTarget.name,
      actor: {
        uid: adminProfile.uid,
        email: adminProfile.email,
        role: adminProfile.role,
      },
    });

    setDeletingChan(false);

    if (result.success) {
      setChannels((prev) => prev.filter((c) => c.id !== deleteChanTarget.id));
      setPackages((prev) =>
        prev.map((p) =>
          p.id === selectedPackageId
            ? { ...p, channelCount: Math.max(0, p.channelCount - 1) }
            : p
        )
      );
      setDeleteChanTarget(null);
    }
  }

  // ─── Channel Drag & Drop ────────────────────────────────────

  async function handleChannelDragDrop(dropTargetId: string) {
    if (!chanDragItemId || chanDragItemId === dropTargetId || !adminProfile) return;

    const fromIdx = channels.findIndex((c) => c.id === chanDragItemId);
    const toIdx = channels.findIndex((c) => c.id === dropTargetId);
    if (fromIdx === -1 || toIdx === -1) return;

    const reordered = [...channels];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);

    setChannels(reordered);

    const result = await reorderChannelsAction({
      packageId: selectedPackageId!,
      orderedIds: reordered.map((c) => c.id),
      actor: {
        uid: adminProfile.uid,
        email: adminProfile.email,
        role: adminProfile.role,
      },
    });

    if (!result.success && selectedPackageId) {
      loadChannels(selectedPackageId);
    }
  }

  // ─── Drag & Drop Handlers ───────────────────────────────────

  async function handleDragDrop(dropTargetId: string) {
    if (!dragItemId || dragItemId === dropTargetId || !adminProfile) return;

    const fromIdx = packages.findIndex((p) => p.id === dragItemId);
    const toIdx = packages.findIndex((p) => p.id === dropTargetId);
    if (fromIdx === -1 || toIdx === -1) return;

    const reordered = [...packages];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);

    setPackages(reordered);

    const result = await reorderPackagesAction({
      orderedIds: reordered.map((p) => p.id),
      actor: {
        uid: adminProfile.uid,
        email: adminProfile.email,
        role: adminProfile.role,
      },
    });

    if (!result.success) {
      loadPackages();
    }
  }

  // ─── Render ──────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-h2 text-text-primary">Sport Packages</h1>
          <p className="text-body text-text-tertiary">
            Manage sport streaming packages and channels
          </p>
        </div>
        {canWrite && (
          <Button
            variant="primary"
            onClick={() => window.location.href = "/packages/new"}
            className="shrink-0"
          >
            <Plus className="h-4 w-4" />
            Create Package
          </Button>
        )}
      </div>

      {/* Error */}
      {error && (
        <Card className="border-border-error">
          <CardContent className="flex items-center justify-between p-4">
            <p className="text-body text-accent-red">{error}</p>
            <Button variant="ghost" size="sm" onClick={loadPackages}>
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ─── Two-column split ─────────────────────────────────── */}
      <div className="flex flex-col gap-6 lg:flex-row lg:gap-4">
        {/* ── Left: Packages grid ── */}
        <div className="min-w-0 flex-1">
          <h2 className="mb-3 text-h3 text-text-primary">Packages</h2>

          {loading ? (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-2">
                    <div className="aspect-[3/4] w-full animate-pulse rounded-lg bg-bg-tertiary" />
                    <div className="mt-2 h-3 w-3/4 animate-pulse rounded bg-bg-tertiary" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : !error && packages.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-12">
                <Package className="h-8 w-8 text-text-disabled" />
                <p className="text-center text-caption text-text-tertiary">
                  No packages yet.
                </p>
                {canWrite && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => window.location.href = "/packages/new"}
                  >
                    <Plus className="h-4 w-4" />
                    Create first package
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {packages.map((pkg) => (
                <Card
                  key={pkg.id}
                  draggable={!!canWrite}
                  onDragStart={() => setDragItemId(pkg.id)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOverId(pkg.id);
                  }}
                  onDrop={() => handleDragDrop(pkg.id)}
                  onDragEnd={() => {
                    setDragItemId(null);
                    setDragOverId(null);
                  }}
                  className={`group relative overflow-hidden transition-shadow hover:shadow-md ${
                    selectedPackageId === pkg.id ? "ring-2 ring-accent-blue" : ""
                  } ${
                    dragOverId === pkg.id && dragItemId !== pkg.id
                      ? "ring-2 ring-accent-gold scale-[1.02]"
                      : ""
                  } ${
                    dragItemId === pkg.id ? "opacity-40" : ""
                  } cursor-grab active:cursor-grabbing`}
                  onMouseEnter={() => canWrite && setHoveredPkgId(pkg.id)}
                  onMouseLeave={() => setHoveredPkgId(null)}
                >
                  <CardContent className="p-0">
                    <div className="relative aspect-[3/4] overflow-hidden bg-bg-tertiary">
                      {pkg.imageUrl ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={pkg.imageUrl}
                          alt={pkg.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <Package className="h-6 w-6 text-text-disabled" />
                        </div>
                      )}

                      <div className="absolute left-1.5 top-1.5">
                        <Badge variant={pkg.isActive ? "green" : "disabled"} className="text-[9px] px-1 py-0.5">
                          {pkg.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </div>

                      <div className="absolute right-1.5 top-1.5">
                        <Badge variant="blue" className="text-[9px] px-1 py-0.5">{pkg.category}</Badge>
                      </div>

                      {hoveredPkgId === pkg.id && canWrite && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-black/60 p-1.5">
                          <button
                            onClick={() => selectPackage(pkg.id, pkg.name, "edit")}
                            className="flex w-full items-center justify-center gap-1 rounded bg-accent-gold px-1.5 py-1 text-[9px] font-medium text-button-primary-text transition-colors hover:bg-accent-gold-hover"
                          >
                            <Edit className="h-2.5 w-2.5 shrink-0" />
                            Edit
                          </button>
                          <button
                            onClick={() => selectPackage(pkg.id, pkg.name, "channels")}
                            className="flex w-full items-center justify-center gap-1 rounded bg-accent-blue px-1.5 py-1 text-[9px] font-medium text-button-secondary-text transition-colors hover:bg-accent-blue-hover"
                          >
                            <Eye className="h-2.5 w-2.5 shrink-0" />
                            Channels
                          </button>
                          <button
                            onClick={() => setDeleteTarget(pkg)}
                            className="flex w-full items-center justify-center gap-1 rounded bg-accent-red px-1.5 py-1 text-[9px] font-medium text-white transition-colors hover:bg-accent-red-hover"
                          >
                            <Trash2 className="h-2.5 w-2.5 shrink-0" />
                            Delete
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="p-2">
                      <h3 className="truncate text-[11px] font-semibold text-text-primary">
                        {pkg.name}
                      </h3>
                      <div className="mt-1 flex items-center gap-1 text-[10px] text-text-disabled">
                        <Tv className="h-2.5 w-2.5" />
                        <span>{pkg.channelCount} ch</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* ── Right: Channels / Edit ── */}
        <div className="min-w-0 flex-1">
          {/* Header with mode tabs */}
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <h2 className="text-h3 text-text-primary truncate">
                {selectedPackageId ? selectedPkgName : "Channels"}
              </h2>
              {selectedPackageId && canWrite && (
                <div className="flex shrink-0 gap-1">
                  <button
                    onClick={() => setRightMode("channels")}
                    className={`rounded px-2 py-1 text-[11px] font-medium transition-colors ${
                      rightMode === "channels"
                        ? "bg-accent-blue text-white"
                        : "bg-bg-tertiary text-text-secondary hover:bg-bg-tertiary/80"
                    }`}
                  >
                    Channels
                  </button>
                  <button
                    onClick={() => {
                      const pkg = packages.find((p) => p.id === selectedPackageId);
                      if (pkg) {
                        setEditForm({
                          name: pkg.name,
                          description: pkg.description ?? "",
                          category: pkg.category as PackageFormValues["category"],
                          isActive: pkg.isActive,
                          displayOrder: pkg.displayOrder,
                          imageUrl: pkg.imageUrl,
                          licenseNotes: pkg.licenseNotes ?? "",
                        });
                      }
                      setRightMode("edit");
                    }}
                    className={`rounded px-2 py-1 text-[11px] font-medium transition-colors ${
                      rightMode === "edit"
                        ? "bg-accent-gold text-button-primary-text"
                        : "bg-bg-tertiary text-text-secondary hover:bg-bg-tertiary/80"
                    }`}
                  >
                    Edit
                  </button>
                </div>
              )}
            </div>
            {selectedPackageId && (
              <button
                onClick={closePanel}
                className="shrink-0 rounded p-1 text-text-disabled hover:bg-bg-tertiary hover:text-text-primary"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {!selectedPackageId ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-12">
                <Eye className="h-8 w-8 text-text-disabled" />
                <p className="text-center text-caption text-text-tertiary">
                  Select a package to manage its channels or edit its details
                </p>
              </CardContent>
            </Card>
          ) : rightMode === "edit" ? (
            /* ── Edit mode ── */
            <div className="space-y-4">
              {/* Image */}
              <div>
                <label className="mb-1 block text-caption font-medium text-text-secondary">
                  Package Image
                </label>
                <div className="w-1/3">
                  <ImageUpload
                    value={editForm.imageUrl}
                    onChange={(url) => setEditForm({ ...editForm, imageUrl: url })}
                    path="packages"
                    aspectRatio="aspect-[3/4]"
                  />
                </div>
              </div>

              {/* Name */}
              <div>
                <label className="mb-1 block text-caption font-medium text-text-secondary">
                  Package Name
                </label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) =>
                    setEditForm({ ...editForm, name: e.target.value })
                  }
                  className="w-full rounded-lg border border-border-primary bg-bg-primary px-3 py-2 text-body text-text-primary placeholder:text-text-disabled outline-none focus:border-accent-blue"
                  placeholder="Package name"
                />
              </div>



              {/* Active toggle */}
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={editForm.isActive}
                  onChange={(e) =>
                    setEditForm({ ...editForm, isActive: e.target.checked })
                  }
                  className="h-4 w-4 rounded border-border-primary accent-accent-blue"
                />
                <span className="text-caption text-text-secondary">Package is active</span>
              </label>

              {editError && (
                <p className="text-caption text-accent-red">{editError}</p>
              )}

              <Button
                variant="primary"
                className="w-full"
                loading={editSaving}
                onClick={handleEditSave}
              >
                <Save className="h-4 w-4" />
                Save Changes
              </Button>
            </div>
          ) : (
            /* ── Channels mode ── */
            <>
              {canWrite && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={startAddChannel}
                  className="mb-3 w-full"
                >
                  <Plus className="h-4 w-4" />
                  Add Channel
                </Button>
              )}

              {channelsLoading ? (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Card key={i}>
                      <CardContent className="p-2">
                        <div className="aspect-[3/4] w-full animate-pulse rounded-lg bg-bg-tertiary" />
                        <div className="mt-2 h-3 w-3/4 animate-pulse rounded bg-bg-tertiary" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : channels.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center gap-3 py-12">
                    <Tv className="h-8 w-8 text-text-disabled" />
                    <p className="text-center text-caption text-text-tertiary">
                      No channels in this package yet.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {channels.map((chan) => (
                    <Card
                      key={chan.id}
                      draggable={!!canWrite}
                      onDragStart={() => setChanDragItemId(chan.id)}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setChanDragOverId(chan.id);
                      }}
                      onDrop={() => handleChannelDragDrop(chan.id)}
                      onDragEnd={() => {
                        setChanDragItemId(null);
                        setChanDragOverId(null);
                      }}
                      className={`group relative overflow-hidden ${
                        chanDragOverId === chan.id && chanDragItemId !== chan.id
                          ? "ring-2 ring-accent-gold scale-[1.02]"
                          : ""
                      } ${
                        chanDragItemId === chan.id ? "opacity-40" : ""
                      } cursor-grab active:cursor-grabbing`}
                      onMouseEnter={() => canWrite && setHoveredChanId(chan.id)}
                      onMouseLeave={() => setHoveredChanId(null)}
                    >
                      <CardContent className="p-0">
                        <div className="relative aspect-[3/4] overflow-hidden bg-bg-tertiary">
                          {chan.logoUrl ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                              src={chan.logoUrl}
                              alt={chan.name}
                              className="h-full w-full object-contain p-2"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center">
                              <Signal className="h-6 w-6 text-text-disabled" />
                            </div>
                          )}

                          <div className="absolute left-1.5 top-1.5">
                            <Badge variant={getQualityColor(chan.quality)} className="text-[9px] px-1 py-0.5">
                              {chan.quality}
                            </Badge>
                          </div>

                          <div className="absolute right-1.5 top-1.5">
                            <div
                              className={`h-1.5 w-1.5 rounded-full ${
                                chan.isActive ? "bg-accent-green" : "bg-text-disabled"
                              }`}
                            />
                          </div>

                          {hoveredChanId === chan.id && canWrite && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-black/60 p-1.5">
                              <button
                                onClick={() => startChannelEdit(chan)}
                                className="flex w-full items-center justify-center gap-1 rounded bg-accent-gold px-1.5 py-1 text-[9px] font-medium text-button-primary-text transition-colors hover:bg-accent-gold-hover"
                              >
                                <Edit className="h-2.5 w-2.5 shrink-0" />
                                Edit
                              </button>
                              <button
                                onClick={() => setDeleteChanTarget(chan)}
                                className="flex w-full items-center justify-center gap-1 rounded bg-accent-red px-1.5 py-1 text-[9px] font-medium text-white transition-colors hover:bg-accent-red-hover"
                              >
                                <Trash2 className="h-2.5 w-2.5 shrink-0" />
                                Delete
                              </button>
                            </div>
                          )}
                        </div>

                        <div className="p-2">
                          <h3 className="truncate text-[11px] font-semibold text-text-primary">
                            {chan.name}
                          </h3>
                          <p className="mt-0.5 truncate text-[10px] text-text-tertiary">
                            {chan.streamUrl}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ── Inline Channel Edit/Add Form ── */}
          {(editingChannel || addingChannel) && (
            <Card>
              <CardContent className="space-y-4 p-4">
                <h3 className="text-body-sm font-semibold text-text-primary">
                  {editingChannel ? "Edit Channel" : "Add Channel"}
                </h3>

                {/* Logo */}
                <div>
                  <label className="mb-1 block text-caption font-medium text-text-secondary">
                    Channel Logo
                  </label>
                  <div className="w-1/2">
                    <ImageUpload
                      value={channelEditLogo}
                      onChange={setChannelEditLogo}
                      path="packages/channels"
                      aspectRatio="aspect-[3/4]"
                    />
                  </div>
                </div>

                {/* Name */}
                <div>
                  <label className="mb-1 block text-caption font-medium text-text-secondary">
                    Channel Name
                  </label>
                  <input
                    type="text"
                    value={channelEditName}
                    onChange={(e) => setChannelEditName(e.target.value)}
                    className="w-full rounded-lg border border-border-primary bg-bg-primary px-3 py-2 text-body text-text-primary placeholder:text-text-disabled outline-none focus:border-accent-blue"
                    placeholder="e.g. Sports HD 1"
                  />
                </div>

                {/* Stream URLs */}
                <div>
                  <label className="mb-1 block text-caption font-medium text-text-secondary">
                    Stream URLs
                  </label>
                  <div className="space-y-2">
                    {channelEditStreamUrls.map((url, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input
                          type="url"
                          value={url}
                          onChange={(e) => updateStreamUrl(i, e.target.value)}
                          className="flex-1 rounded-lg border border-border-primary bg-bg-primary px-3 py-2 text-body text-text-primary placeholder:text-text-disabled outline-none focus:border-accent-blue"
                          placeholder="https://example.com/stream.m3u8"
                        />
                        {channelEditStreamUrls.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeStreamUrl(i)}
                            className="shrink-0 rounded p-1 text-text-disabled hover:text-accent-red"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={addStreamUrl}
                    className="mt-1.5 flex items-center gap-1 text-[11px] font-medium text-accent-blue hover:text-accent-blue-hover"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add URL
                  </button>
                </div>

                {/* Quality */}
                <div>
                  <label className="mb-1 block text-caption font-medium text-text-secondary">
                    Quality
                  </label>
                  <select
                    value={channelEditQuality}
                    onChange={(e) => setChannelEditQuality(e.target.value)}
                    className="w-full rounded-lg border border-border-primary bg-bg-primary px-3 py-2 text-body text-text-primary outline-none focus:border-accent-blue"
                  >
                    <option value="auto">Auto</option>
                    <option value="1080p">1080p</option>
                    <option value="720p">720p</option>
                    <option value="480p">480p</option>
                  </select>
                </div>

                {/* Active */}
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={channelEditActive}
                    onChange={(e) => setChannelEditActive(e.target.checked)}
                    className="h-4 w-4 rounded border-border-primary accent-accent-blue"
                  />
                  <span className="text-caption text-text-secondary">Channel is active</span>
                </label>

                {channelEditError && (
                  <p className="text-caption text-accent-red">{channelEditError}</p>
                )}

                <div className="flex justify-end gap-3 pt-2">
                  <Button variant="ghost" onClick={cancelChannelEdit} disabled={channelSaving}>
                    Cancel
                  </Button>
                  <Button variant="primary" loading={channelSaving} onClick={handleChannelSave}>
                    {editingChannel ? "Update Channel" : "Add Channel"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* ─── Channel Delete Confirmation ───────────────────────── */}
      <Modal
        open={!!deleteChanTarget}
        onClose={() => setDeleteChanTarget(null)}
        title="Delete Channel"
        description="This will permanently delete this channel. This action cannot be undone."
        variant="danger"
      >
        {deleteChanTarget && (
          <div className="space-y-4">
            <p className="text-body text-text-secondary">
              Are you sure you want to delete{" "}
              <span className="font-semibold text-text-primary">
                {deleteChanTarget.name}
              </span>
              ?
            </p>
            <div className="flex justify-end gap-3">
              <Button
                variant="ghost"
                onClick={() => setDeleteChanTarget(null)}
                disabled={deletingChan}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                loading={deletingChan}
                onClick={handleDeleteChannel}
              >
                Delete Channel
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ─── Package Delete Confirmation ──────────────────────── */}
      <Modal
        open={!!deleteTarget}
        onClose={() => {
          setDeleteTarget(null);
          setActionError(null);
        }}
        title="Delete Package"
        description="This will permanently delete the package and all associated channels."
        variant="danger"
      >
        {deleteTarget && (
          <div className="space-y-4">
            <p className="text-body text-text-secondary">
              Are you sure you want to delete{" "}
              <span className="font-semibold text-text-primary">
                {deleteTarget.name}
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
                onClick={handleDeletePackage}
              >
                Delete Package
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
