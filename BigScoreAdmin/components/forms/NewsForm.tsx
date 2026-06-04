"use client";

import { useRouter } from "next/navigation";
import { useState, useMemo } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  newsSchema,
  newsCategories,
  contentLanguages,
  type NewsFormValues,
} from "@/lib/validation/newsSchema";
import { useAuth } from "@/hooks/useAuth";
import { createNewsAction, updateNewsAction } from "@/app/actions/news";
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

interface NewsFormProps {
  initialData?: Partial<NewsFormValues>;
  articleId?: string;
}

export function NewsForm({ initialData, articleId }: NewsFormProps) {
  const router = useRouter();
  const { adminProfile } = useAuth();
  const isEdit = !!articleId;

  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const defaults = useMemo<NewsFormValues>(
    () => ({
      language: (initialData as Record<string, string>)?.["language"] as NewsFormValues["language"] ?? "en",
      title: initialData?.title ?? "",
      summary: initialData?.summary ?? "",
      body: initialData?.body ?? "",
      imageUrl: initialData?.imageUrl ?? "",
      category: (initialData?.category as NewsFormValues["category"]) ?? "Other",
      sourceName: initialData?.sourceName ?? "",
      sourceUrl: initialData?.sourceUrl ?? "",
      isPublished: initialData?.isPublished ?? false,
      isFeatured: initialData?.isFeatured ?? false,
      publishedAt: initialData?.publishedAt ?? "",
      sourceType: (initialData?.sourceType as NewsFormValues["sourceType"]) ?? "manual",
      externalArticleId: String(initialData?.externalArticleId ?? ""),
      // Translations
      title_ar: (initialData as Record<string, string>)?.["title_ar"] ?? "",
      summary_ar: (initialData as Record<string, string>)?.["summary_ar"] ?? "",
      body_ar: (initialData as Record<string, string>)?.["body_ar"] ?? "",
      title_fr: (initialData as Record<string, string>)?.["title_fr"] ?? "",
      summary_fr: (initialData as Record<string, string>)?.["summary_fr"] ?? "",
      body_fr: (initialData as Record<string, string>)?.["body_fr"] ?? "",
      title_es: (initialData as Record<string, string>)?.["title_es"] ?? "",
      summary_es: (initialData as Record<string, string>)?.["summary_es"] ?? "",
      body_es: (initialData as Record<string, string>)?.["body_es"] ?? "",
      title_de: (initialData as Record<string, string>)?.["title_de"] ?? "",
      summary_de: (initialData as Record<string, string>)?.["summary_de"] ?? "",
      body_de: (initialData as Record<string, string>)?.["body_de"] ?? "",
      title_pt: (initialData as Record<string, string>)?.["title_pt"] ?? "",
      summary_pt: (initialData as Record<string, string>)?.["summary_pt"] ?? "",
      body_pt: (initialData as Record<string, string>)?.["body_pt"] ?? "",
    }),
    [initialData]
  );

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<NewsFormValues>({
    resolver: zodResolver(newsSchema),
    defaultValues: defaults,
  });

  async function onSubmit(data: NewsFormValues) {
    if (!adminProfile) return;

    setSaving(true);
    setToast(null);

    try {
      const result = isEdit
        ? await updateNewsAction({
            articleId: articleId!,
            data,
            actor: {
              uid: adminProfile.uid,
              email: adminProfile.email,
              role: adminProfile.role,
            },
          })
        : await createNewsAction({
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
          message: isEdit ? "Article updated." : "Article created.",
        });
        setTimeout(() => router.push("/news"), 800);
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

  function fieldError(field: keyof NewsFormValues): string | undefined {
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
          <Button variant="ghost" size="sm" onClick={() => router.push("/news")}>
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back
          </Button>
          <div>
            <h1 className="text-h2 text-text-primary">
              {isEdit ? "Edit Article" : "New Article"}
            </h1>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Article Details</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <Controller
                name="language"
                control={control}
                render={({ field }) => (
                  <div>
                    <label className="mb-1.5 block text-label text-text-secondary">
                      Language
                    </label>
                    <select
                      value={field.value}
                      onChange={(e) => field.onChange(e.target.value as NewsFormValues["language"])}
                      className="w-full max-w-xs rounded-lg border border-border-default bg-bg-tertiary px-3 py-2.5 text-body text-text-primary focus:border-border-focus focus:outline-none"
                    >
                      {contentLanguages.map((l) => (
                        <option key={l.code} value={l.code}>
                          {l.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              />

              <Controller
                name="title"
                control={control}
                render={({ field }) => (
                  <Input
                    label="Title"
                    placeholder="Article headline"
                    value={field.value}
                    onChange={field.onChange}
                    error={fieldError("title")}
                    maxLength={100}
                  />
                )}
              />

              <div>
                <label className="mb-1.5 block text-label text-text-secondary">
                  Category
                </label>
                <select
                  value={watch("category")}
                  onChange={(e) =>
                    setValue(
                      "category",
                      e.target.value as NewsFormValues["category"],
                      { shouldValidate: true }
                    )
                  }
                  className="w-full max-w-xs rounded-lg border border-border-default bg-bg-tertiary px-3 py-2.5 text-body text-text-primary focus:border-border-focus focus:outline-none"
                >
                  {newsCategories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <Controller
                name="summary"
                control={control}
                render={({ field }) => (
                  <div className="flex flex-col gap-1.5">
                    <label className="text-label text-text-secondary">
                      Summary
                    </label>
                    <textarea
                      value={field.value ?? ""}
                      onChange={field.onChange}
                      maxLength={300}
                      rows={2}
                      placeholder="Brief summary..."
                      className="w-full resize-none rounded-lg border border-border-default bg-bg-tertiary px-4 py-2.5 text-body text-text-primary placeholder:text-text-disabled focus:border-border-focus focus:outline-none focus:ring-1 focus:ring-border-focus"
                    />
                  </div>
                )}
              />

              <Controller
                name="body"
                control={control}
                render={({ field }) => (
                  <div className="flex flex-col gap-1.5">
                    <label className="text-label text-text-secondary">
                      Content
                    </label>
                    <textarea
                      value={field.value ?? ""}
                      onChange={field.onChange}
                      rows={8}
                      placeholder="Write your article content here..."
                      className="w-full resize-y rounded-lg border border-border-default bg-bg-tertiary px-4 py-2.5 text-body text-text-primary placeholder:text-text-disabled focus:border-border-focus focus:outline-none focus:ring-1 focus:ring-border-focus"
                    />
                    {fieldError("body") && (
                      <p className="text-caption text-accent-red">
                        {fieldError("body")}
                      </p>
                    )}
                  </div>
                )}
              />

              <Controller
                name="imageUrl"
                control={control}
                render={({ field }) => (
                  <ImageUpload
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    path={`news/${articleId || "new"}`}
                    aspectRatio="aspect-[16/9]"
                    label="Featured Image (16:9)"
                  />
                )}
              />

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Controller
                  name="sourceName"
                  control={control}
                  render={({ field }) => (
                    <Input
                      label="Source Name"
                      placeholder="e.g. ESPN"
                      value={field.value ?? ""}
                      onChange={field.onChange}
                    />
                  )}
                />
                <Controller
                  name="sourceUrl"
                  control={control}
                  render={({ field }) => (
                    <Input
                      label="Source URL"
                      type="url"
                      placeholder="https://..."
                      value={field.value ?? ""}
                      onChange={field.onChange}
                      error={fieldError("sourceUrl")}
                    />
                  )}
                />
              </div>

              <Controller
                name="publishedAt"
                control={control}
                render={({ field }) => (
                  <Input
                    label="Published Date"
                    type="datetime-local"
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    helperText="Leave empty to use current time."
                  />
                )}
              />
            </CardContent>
          </Card>

          {/* Translations Section */}
          <Card>
            <CardHeader>
              <CardTitle>Translations</CardTitle>
              <p className="text-body-sm text-text-tertiary">
                Add translated content for each supported language. Leave blank to use the English version as fallback.
              </p>
            </CardHeader>
            <CardContent className="flex flex-col gap-6">
              {contentLanguages.filter(l => l.code !== "en").map((lang) => (
                <div key={lang.code} className="rounded-lg border border-border-muted p-4">
                  <h3 className="text-body-lg font-semibold text-text-primary mb-3">
                    {lang.label}
                  </h3>
                  <div className="flex flex-col gap-3">
                    <Controller
                      name={`title_${lang.code}` as keyof NewsFormValues}
                      control={control}
                      render={({ field }) => (
                        <Input
                          label={`Title (${lang.label})`}
                          value={(field.value as string) ?? ""}
                          onChange={field.onChange}
                          maxLength={100}
                        />
                      )}
                    />
                    <div className="flex flex-col gap-1.5">
                      <label className="text-label text-text-secondary">
                        Summary ({lang.label})
                      </label>
                      <textarea
                        value={(watch(`summary_${lang.code}` as keyof NewsFormValues) as string) ?? ""}
                        onChange={(e) =>
                          setValue(`summary_${lang.code}` as keyof NewsFormValues, e.target.value as never)
                        }
                        maxLength={300}
                        rows={2}
                        className="w-full resize-none rounded-lg border border-border-default bg-bg-tertiary px-4 py-2.5 text-body text-text-primary placeholder:text-text-disabled focus:border-border-focus focus:outline-none"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-label text-text-secondary">
                        Content ({lang.label})
                      </label>
                      <textarea
                        value={(watch(`body_${lang.code}` as keyof NewsFormValues) as string) ?? ""}
                        onChange={(e) =>
                          setValue(`body_${lang.code}` as keyof NewsFormValues, e.target.value as never)
                        }
                        rows={5}
                        className="w-full resize-y rounded-lg border border-border-default bg-bg-tertiary px-4 py-2.5 text-body text-text-primary placeholder:text-text-disabled focus:border-border-focus focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Publishing</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <Controller
                name="isPublished"
                control={control}
                render={({ field }) => (
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    label="Published"
                    description="Make this article visible in the iOS app."
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
                    description="Promote this article on the homepage."
                  />
                )}
              />
            </CardContent>
          </Card>

          <div className="flex items-center gap-3">
            <Button type="submit" variant="primary" size="lg" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              <Save className="h-4 w-4" />
              {isEdit ? "Update Article" : "Create Article"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => router.push("/news")}
            >
              Cancel
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
