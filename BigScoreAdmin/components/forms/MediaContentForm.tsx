"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  mediaSchema,
  ratingOptions,
  mediaCategories,
  type MediaFormValues,
} from "@/lib/validation/mediaSchema";
import { useAuth } from "@/hooks/useAuth";
import { createMediaAction, updateMediaAction } from "@/app/actions/media";
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
} from "lucide-react";

const licenseStatusOptions = [
  { value: "verified", label: "Verified" },
  { value: "pending", label: "Pending" },
  { value: "expired", label: "Expired" },
];

interface MediaFormProps {
  initialData?: Partial<MediaFormValues>;
  mediaId?: string;
}

export function MediaContentForm({ initialData, mediaId }: MediaFormProps) {
  const router = useRouter();
  const { adminProfile } = useAuth();
  const isEdit = !!mediaId;

  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const defaults = useMemo<MediaFormValues>(
    () => ({
      type: (initialData?.type as MediaFormValues["type"]) ?? "movie",
      title: initialData?.title ?? "",
      description: initialData?.description ?? "",
      posterUrl: initialData?.posterUrl ?? "",
      backdropUrl: initialData?.backdropUrl ?? "",
      releaseYear: initialData?.releaseYear as number | undefined,
      durationMinutes: initialData?.durationMinutes as number | undefined,
      categories: (initialData?.categories as string[]) ?? [],
      rating: (initialData?.rating as MediaFormValues["rating"]) ?? undefined,
      videoUrl: initialData?.videoUrl ?? "",
      isActive: initialData?.isActive ?? true,
      isFeatured: initialData?.isFeatured ?? false,
      licenseStatus: (initialData?.licenseStatus as MediaFormValues["licenseStatus"]) ?? "verified",
      licenseExpiresAt: initialData?.licenseExpiresAt ?? "",
      providerName: initialData?.providerName ?? "",
    }),
    [initialData]
  );

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<MediaFormValues>({
    resolver: zodResolver(mediaSchema),
    defaultValues: defaults,
  });

  const watchType = watch("type");
  const watchCategories = watch("categories");

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  function toggleCategory(cat: string) {
    const current = watchCategories ?? [];
    if (current.includes(cat)) {
      setValue(
        "categories",
        current.filter((c) => c !== cat),
        { shouldValidate: true }
      );
    } else {
      setValue("categories", [...current, cat], { shouldValidate: true });
    }
  }

  async function onSubmit(data: MediaFormValues) {
    if (!adminProfile) return;

    if (!data.posterUrl) {
      setToast({ type: "error", message: "Poster image is required." });
      return;
    }

    setSaving(true);
    setToast(null);

    try {
      const result = isEdit
        ? await updateMediaAction({
            mediaId: mediaId!,
            data,
            actor: {
              uid: adminProfile.uid,
              email: adminProfile.email,
              role: adminProfile.role,
            },
          })
        : await createMediaAction({
            data,
            actor: {
              uid: adminProfile.uid,
              email: adminProfile.email,
              role: adminProfile.role,
            },
          });

      if (result.success) {
        setToast({
          type: "success",
          message: isEdit ? "Content updated." : "Content created.",
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

  function fieldError(field: keyof MediaFormValues): string | undefined {
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
              {isEdit
                ? `Edit ${watchType === "movie" ? "Movie" : "Series"}`
                : "Add Content"}
            </h1>
            <p className="text-body text-text-tertiary">
              {isEdit ? "Update content details" : "Add a new movie or series"}
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="flex flex-col gap-6">
          {/* Type & Basic */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-label text-text-secondary">
                    Content Type
                  </label>
                  <div className="flex gap-2">
                    {(["movie", "series"] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setValue("type", t, { shouldValidate: true })}
                        className={cn(
                          "rounded-lg px-4 py-2 text-body-sm font-medium transition-colors",
                          watchType === t
                            ? "bg-accent-gold text-button-primary-text"
                            : "bg-bg-tertiary text-text-secondary hover:text-text-primary"
                        )}
                      >
                        {t === "movie" ? "Movie" : "Series"}
                      </button>
                    ))}
                  </div>
                </div>

                <Controller
                  name="title"
                  control={control}
                  render={({ field }) => (
                    <Input
                      label="Title"
                      placeholder="Enter title"
                      value={field.value}
                      onChange={field.onChange}
                      error={fieldError("title")}
                      maxLength={100}
                    />
                  )}
                />

                <Controller
                  name="releaseYear"
                  control={control}
                  render={({ field }) => (
                    <Input
                      label="Release Year"
                      type="number"
                      min={1900}
                      max={new Date().getFullYear() + 1}
                      placeholder="2024"
                      value={field.value ?? ""}
                      onChange={(e) =>
                        field.onChange(
                          e.target.value ? parseInt(e.target.value, 10) : undefined
                        )
                      }
                      error={fieldError("releaseYear")}
                    />
                  )}
                />

                {watchType === "movie" && (
                  <Controller
                    name="durationMinutes"
                    control={control}
                    render={({ field }) => (
                      <Input
                        label="Duration (minutes)"
                        type="number"
                        min={1}
                        placeholder="120"
                        value={field.value ?? ""}
                        onChange={(e) =>
                          field.onChange(
                            e.target.value ? parseInt(e.target.value, 10) : undefined
                          )
                        }
                        error={fieldError("durationMinutes")}
                      />
                    )}
                  />
                )}

                <div>
                  <label className="mb-1.5 block text-label text-text-secondary">
                    Rating
                  </label>
                  <select
                    value={watch("rating") ?? ""}
                    onChange={(e) =>
                      setValue("rating", (e.target.value || undefined) as MediaFormValues["rating"], {
                        shouldValidate: true,
                      })
                    }
                    className="w-full rounded-lg border border-border-default bg-bg-tertiary px-3 py-2.5 text-body text-text-primary focus:border-border-focus focus:outline-none"
                  >
                    <option value="">Not rated</option>
                    {ratingOptions.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <Controller
                    name="description"
                    control={control}
                    render={({ field }) => {
                      const chars = field.value?.length ?? 0;
                      return (
                        <div className="flex flex-col gap-1.5">
                          <label className="text-label text-text-secondary">
                            Description
                          </label>
                          <textarea
                            value={field.value ?? ""}
                            onChange={field.onChange}
                            maxLength={500}
                            rows={3}
                            placeholder="Brief description..."
                            className="w-full resize-none rounded-lg border border-border-default bg-bg-tertiary px-4 py-2.5 text-body text-text-primary placeholder:text-text-disabled focus:border-border-focus focus:outline-none focus:ring-1 focus:ring-border-focus"
                          />
                          <div className="flex justify-end">
                            <span
                              className={cn(
                                "text-caption",
                                chars > 450 ? "text-accent-red" : "text-text-disabled"
                              )}
                            >
                              {chars}/500
                            </span>
                          </div>
                          {fieldError("description") && (
                            <p className="text-caption text-accent-red">
                              {fieldError("description")}
                            </p>
                          )}
                        </div>
                      );
                    }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Images */}
          <Card>
            <CardHeader>
              <CardTitle>Images</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <Controller
                  name="posterUrl"
                  control={control}
                  render={({ field }) => (
                    <ImageUpload
                      value={field.value}
                      onChange={field.onChange}
                      path={`media/${mediaId || "new"}`}
                      aspectRatio="aspect-[2/3]"
                      label="Poster (2:3)"
                      error={fieldError("posterUrl")}
                    />
                  )}
                />

                <Controller
                  name="backdropUrl"
                  control={control}
                  render={({ field }) => (
                    <ImageUpload
                      value={field.value ?? ""}
                      onChange={field.onChange}
                      path={`media/${mediaId || "new"}/backdrops`}
                      aspectRatio="aspect-[16/9]"
                      label="Backdrop (16:9)"
                    />
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Categories */}
          <Card>
            <CardHeader>
              <CardTitle>Categories</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {mediaCategories.map((cat) => {
                  const active = (watchCategories ?? []).includes(cat);
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => toggleCategory(cat)}
                      className={cn(
                        "rounded-full px-3 py-1.5 text-label transition-colors",
                        active
                          ? "bg-accent-gold/15 text-accent-gold"
                          : "bg-bg-tertiary text-text-tertiary hover:text-text-secondary"
                      )}
                    >
                      {cat}
                    </button>
                  );
                })}
              </div>
              {(watchCategories ?? []).length === 0 && (
                <p className="mt-3 text-caption text-text-disabled">
                  Select one or more categories.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Video & Streaming */}
          <Card>
            <CardHeader>
              <CardTitle>Video &amp; Streaming</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <Controller
                name="videoUrl"
                control={control}
                render={({ field }) => (
                  <Input
                    label="Video URL"
                    type="url"
                    placeholder="https://..."
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    error={fieldError("videoUrl")}
                  />
                )}
              />

              <Controller
                name="providerName"
                control={control}
                render={({ field }) => (
                  <Input
                    label="Provider Name"
                    placeholder="e.g. Netflix, Hulu"
                    value={field.value ?? ""}
                    onChange={field.onChange}
                  />
                )}
              />
            </CardContent>
          </Card>

          {/* License */}
          <Card>
            <CardHeader>
              <CardTitle>License &amp; Compliance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-label text-text-secondary">
                    License Status *
                  </label>
                  <select
                    value={watch("licenseStatus")}
                    onChange={(e) =>
                      setValue(
                        "licenseStatus",
                        e.target.value as MediaFormValues["licenseStatus"],
                        { shouldValidate: true }
                      )
                    }
                    className="w-full rounded-lg border border-border-default bg-bg-tertiary px-3 py-2.5 text-body text-text-primary focus:border-border-focus focus:outline-none"
                  >
                    {licenseStatusOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  {fieldError("licenseStatus") && (
                    <p className="mt-1 text-caption text-accent-red">
                      {fieldError("licenseStatus")}
                    </p>
                  )}
                </div>

                <Controller
                  name="licenseExpiresAt"
                  control={control}
                  render={({ field }) => (
                    <Input
                      label="License Expiration"
                      type="date"
                      value={field.value ?? ""}
                      onChange={field.onChange}
                    />
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Publishing */}
          <Card>
            <CardHeader>
              <CardTitle>Publishing</CardTitle>
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
                    description="Make this content visible in the iOS app."
                  />
                )}
              />

              <Controller
                name="isFeatured"
                control={control}
                render={({ field }) => (
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    label="Featured"
                    description="Promote this content on the homepage."
                  />
                )}
              />
            </CardContent>
          </Card>

          <div className="flex items-center gap-3">
            <Button type="submit" variant="primary" size="lg" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              <Save className="h-4 w-4" />
              {isEdit ? "Update Content" : "Create Content"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => router.push("/packages")}
            >
              Cancel
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
