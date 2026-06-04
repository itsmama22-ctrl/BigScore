"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  packageSchema,
  type PackageFormValues,
  type ChannelFormValues,
} from "@/lib/validation/packageSchema";
import { useAuth } from "@/hooks/useAuth";
import {
  createPackageAction,
  updatePackageAction,
} from "@/app/actions/packages";
import { ImageUpload } from "@/components/forms/ImageUpload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  Save,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  GripVertical,
} from "lucide-react";


const qualityOptions = ["auto", "1080p", "720p", "480p"] as const;


interface ChannelState extends ChannelFormValues {
  key: string;
  id?: string;
  streamUrls: string[];
}

let channelCounter = 0;
function nextChannelKey(): string {
  channelCounter += 1;
  return `ch-${Date.now()}-${channelCounter}`;
}

interface PackageFormProps {
  initialData?: Partial<PackageFormValues>;
  initialChannels?: (ChannelFormValues & { id?: string })[];
  packageId?: string;
}

export function PackageForm({
  initialData,
  initialChannels = [],
  packageId,
}: PackageFormProps) {
  const router = useRouter();
  const { adminProfile } = useAuth();
  const isEdit = !!packageId;

  const [channels, setChannels] = useState<ChannelState[]>(() =>
    initialChannels.length > 0
      ? initialChannels.map((ch) => ({
          ...ch,
          key: nextChannelKey(),
          id: (ch as ChannelFormValues & { id: string }).id,
          streamUrls: (ch as ChannelFormValues & { streamUrls?: string[] }).streamUrls?.length
            ? (ch as ChannelFormValues & { streamUrls?: string[] }).streamUrls!
            : [ch.streamUrl || ""],
        }))
      : [
          {
            key: nextChannelKey(),
            name: "",
            logoUrl: "",
            streamUrl: "",
            streamProvider: "",
            quality: "auto",
            isActive: true,
            displayOrder: 0,
            licenseStatus: "verified",
            licenseExpiresAt: "",
            streamUrls: [""],
          },
        ]
  );

  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const defaults = useMemo<PackageFormValues>(
    () => ({
      name: initialData?.name ?? "",
      description: initialData?.description ?? "",
      category: (initialData?.category as PackageFormValues["category"]) ?? "Football",
      isActive: initialData?.isActive ?? true,
      displayOrder: initialData?.displayOrder ?? 0,
      imageUrl: initialData?.imageUrl ?? "",
      licenseNotes: initialData?.licenseNotes ?? "",
    }),
    [initialData]
  );

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<PackageFormValues>({
    resolver: zodResolver(packageSchema),
    defaultValues: defaults,
  });

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  function updateChannel(index: number, patch: Partial<ChannelState>) {
    setChannels((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...patch };
      return next;
    });
  }

  function addChannel() {
    setChannels((prev) => [
      ...prev,
      {
        key: nextChannelKey(),
        name: "",
        logoUrl: "",
        streamUrl: "",
        streamProvider: "",
        quality: "auto",
        isActive: true,
        displayOrder: prev.length,
        licenseStatus: "verified",
        licenseExpiresAt: "",
        streamUrls: [""],
      },
    ]);
  }

  function removeChannel(index: number) {
    if (channels.length <= 1) return;
    setChannels((prev) => prev.filter((_, i) => i !== index));
  }

  function addStreamUrl(channelIndex: number) {
    updateChannel(channelIndex, {
      streamUrls: [...(channels[channelIndex]?.streamUrls ?? []), ""],
    });
  }

  function removeStreamUrl(channelIndex: number, urlIndex: number) {
    const urls = channels[channelIndex]?.streamUrls ?? [];
    if (urls.length <= 1) return;
    updateChannel(channelIndex, {
      streamUrls: urls.filter((_, i) => i !== urlIndex),
    });
  }

  async function onSubmit(data: PackageFormValues) {
    if (!adminProfile) return;

    if (!data.imageUrl) {
      setToast({ type: "error", message: "Please upload a package image." });
      return;
    }

    const validChannels = channels
      .filter((ch) => ch.name.trim())
      .map((ch) => ({
        ...ch,
        streamUrl: ch.streamUrls.find((u) => u.trim()) || "",
        streamUrls: ch.streamUrls.filter((u) => u.trim()),
      }));

    setSaving(true);
    setToast(null);

    try {
      const result = isEdit
        ? await updatePackageAction({
            packageId: packageId!,
            data,
            channels: validChannels,
            actor: {
              uid: adminProfile.uid,
              email: adminProfile.email,
              role: adminProfile.role,
            },
          })
        : await createPackageAction({
            data,
            channels: validChannels,
            actor: {
              uid: adminProfile.uid,
              email: adminProfile.email,
              role: adminProfile.role,
            },
          });

      if (result.success) {
        setToast({
          type: "success",
          message: isEdit ? "Package updated." : "Package created.",
        });
        setTimeout(() => router.push("/packages"), 800);
      } else {
        setToast({
          type: "error",
          message: result.error ?? "An error occurred.",
        });
      }
    } catch {
      setToast({ type: "error", message: "An unexpected error occurred." });
    } finally {
      setSaving(false);
    }
  }

  function fieldError(field: keyof PackageFormValues): string | undefined {
    const e = errors[field];
    return e ? (e.message as string) : undefined;
  }

  return (
    <div className="flex flex-col gap-6">
      {toast && (
        <div
          className={cn(
            "flex items-center gap-3 rounded-lg border px-4 py-3",
            toast.type === "success"
              ? "border-accent-green/30 bg-accent-green/10"
              : "border-accent-red/30 bg-accent-red/10"
          )}
        >
          {toast.type === "success" ? (
            <CheckCircle2 className="h-5 w-5 shrink-0 text-accent-green" />
          ) : (
            <AlertCircle className="h-5 w-5 shrink-0 text-accent-red" />
          )}
          <p className="text-body text-text-primary flex-1">{toast.message}</p>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.push("/packages")}>
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back
          </Button>
          <div>
            <h1 className="text-h2 text-text-primary">
              {isEdit ? "Edit Package" : "Create Package"}
            </h1>
            <p className="text-body text-text-tertiary">
              {isEdit
                ? "Update package details and manage channels"
                : "Create a new sport streaming package"}
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="flex flex-col gap-6">
          {/* Basic Info */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
            </CardHeader>
            <CardContent>
              <Controller
                name="name"
                control={control}
                render={({ field }) => (
                  <Input
                    label="Package Name"
                    placeholder="e.g. Premier League Pass"
                    value={field.value}
                    onChange={field.onChange}
                    error={fieldError("name")}
                    maxLength={50}
                  />
                )}
              />
            </CardContent>
          </Card>

          {/* Image Upload */}
          <Card>
            <CardHeader>
              <CardTitle>Package Image</CardTitle>
            </CardHeader>
            <CardContent>
              <Controller
                name="imageUrl"
                control={control}
                render={({ field }) => (
                  <ImageUpload
                    value={field.value}
                    onChange={field.onChange}
                    path={`packages/${packageId || "new"}`}
                    aspectRatio="aspect-[2/2.3]"
                    label="Upload Package Image"
                    error={fieldError("imageUrl")}
                    className="max-w-sm"
                  />
                )}
              />
            </CardContent>
          </Card>

          {/* Toggles */}
          <Card>
            <CardHeader>
              <CardTitle>Settings</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <Controller
                name="isActive"
                control={control}
                render={({ field }) => (
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    label="Active"
                    description="Make this package visible in the iOS app."
                  />
                )}
              />

              <Controller
                name="displayOrder"
                control={control}
                render={({ field }) => (
                  <Input
                    label="Display Order"
                    type="number"
                    min={0}
                    value={field.value ?? 0}
                    onChange={(e) => field.onChange(parseInt(e.target.value, 10) || 0)}
                    helperText="Lower numbers appear first in the app."
                    error={fieldError("displayOrder")}
                    className="max-w-[180px]"
                  />
                )}
              />
            </CardContent>
          </Card>

          {/* Channels */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Channels</CardTitle>
                <p className="mt-1 text-body-sm text-text-tertiary">
                  {channels.length} channel{channels.length !== 1 ? "s" : ""} in this
                  package
                </p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addChannel}>
                <Plus className="h-4 w-4" />
                Add Channel
              </Button>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-6">
                {channels.map((ch, index) => (
                  <div
                    key={ch.key}
                    className="relative rounded-lg border border-border-muted bg-bg-primary p-3"
                  >
                    <div className="mb-2 flex items-center gap-2">
                      <GripVertical className="h-4 w-4 text-text-disabled" />
                      <span className="text-label text-text-secondary">
                        Channel {index + 1}
                      </span>
                      {channels.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeChannel(index)}
                          className="ml-auto rounded-md p-1 text-text-tertiary transition-colors hover:bg-bg-tertiary hover:text-accent-red"
                          title="Remove channel"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>

                    <div className="flex flex-wrap items-start gap-3">
                      <div className="flex min-w-0 flex-1 flex-col gap-2">
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          <input
                            type="text"
                            placeholder="Channel name"
                            value={ch.name}
                            onChange={(e) =>
                              updateChannel(index, { name: e.target.value })
                            }
                            className="w-full rounded-lg border border-border-default bg-bg-tertiary px-3 py-2 text-body text-text-primary placeholder:text-text-disabled focus:border-border-focus focus:outline-none"
                          />

                          <div className="flex flex-col gap-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-caption text-text-tertiary">Stream URLs</span>
                              <button
                                type="button"
                                onClick={() => addStreamUrl(index)}
                                className="text-caption text-accent-blue hover:text-accent-blue/80"
                              >
                                + Add URL
                              </button>
                            </div>
                            {ch.streamUrls.map((url, urlIdx) => (
                              <div key={urlIdx} className="flex items-center gap-1">
                                <input
                                  type="url"
                                  placeholder={`Stream URL ${urlIdx + 1} (https://...)`}
                                  value={url}
                                  onChange={(e) => {
                                    const next = [...ch.streamUrls];
                                    next[urlIdx] = e.target.value;
                                    updateChannel(index, { streamUrls: next });
                                  }}
                                  className="w-full rounded-lg border border-border-default bg-bg-tertiary px-3 py-2 text-body text-text-primary placeholder:text-text-disabled focus:border-border-focus focus:outline-none"
                                />
                                {ch.streamUrls.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => removeStreamUrl(index, urlIdx)}
                                    className="shrink-0 rounded-md p-1 text-text-tertiary hover:text-accent-red"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <select
                            value={ch.quality}
                            onChange={(e) =>
                              updateChannel(index, {
                                quality: e.target.value as ChannelFormValues["quality"],
                              })
                            }
                            className="w-full rounded-lg border border-border-default bg-bg-tertiary px-3 py-2 text-body text-text-primary focus:border-border-focus focus:outline-none"
                          >
                            {qualityOptions.map((q) => (
                              <option key={q} value={q}>
                                {q}
                              </option>
                            ))}
                          </select>

                          <input
                            type="number"
                            min={0}
                            placeholder="Order"
                            value={ch.displayOrder ?? 0}
                            onChange={(e) =>
                              updateChannel(index, {
                                displayOrder: parseInt(e.target.value, 10) || 0,
                              })
                            }
                            className="w-full rounded-lg border border-border-default bg-bg-tertiary px-3 py-2 text-body text-text-primary placeholder:text-text-disabled focus:border-border-focus focus:outline-none"
                          />
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={ch.isActive}
                              onChange={(e) =>
                                updateChannel(index, { isActive: e.target.checked })
                              }
                              className="h-4 w-4 rounded border-border-default bg-bg-tertiary text-accent-green focus:ring-border-focus"
                              id={`ch-active-${ch.key}`}
                            />
                            <label
                              htmlFor={`ch-active-${ch.key}`}
                              className="text-body-sm text-text-secondary"
                            >
                              Active
                            </label>
                          </div>
                        </div>
                      </div>

                      <ImageUpload
                        value={ch.logoUrl || ""}
                        onChange={(url) => updateChannel(index, { logoUrl: url })}
                        path={`packages/${packageId || "new"}/channels/${ch.id || index}`}
                        aspectRatio="aspect-[3/4]"
                        label="Image"
                        className="w-[100px] shrink-0"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Submit */}
          <div className="flex items-center gap-3">
            <Button type="submit" variant="primary" size="lg" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              <Save className="h-4 w-4" />
              {isEdit ? "Update Package" : "Create Package"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => router.push("/packages")}>
              Cancel
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
