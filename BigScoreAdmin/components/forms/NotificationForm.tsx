"use client";

import { useState, useMemo } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  notificationSchema,
  notificationTypes,
  audienceOptions,
  type NotificationFormValues,
} from "@/lib/validation/notificationSchema";
import { useAuth } from "@/hooks/useAuth";
import { sendNotificationAction } from "@/app/actions/notifications";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  Send,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Bell,
  Smartphone,
  Globe,
} from "lucide-react";

const typeLabels: Record<string, string> = {
  matchStart: "Match Start",
  goal: "Goal",
  matchEnd: "Match End",
  news: "News",
  announcement: "Announcement",
};

interface NotificationFormProps {
  onSent: () => void;
}

export function NotificationForm({ onSent }: NotificationFormProps) {
  const { adminProfile } = useAuth();
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const {
    control,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<NotificationFormValues>({
    resolver: zodResolver(notificationSchema),
    defaultValues: {
      title_en: "",
      body_en: "",
      title_ar: "",
      body_ar: "",
      title_fr: "",
      body_fr: "",
      notificationType: "announcement",
      targetAudience: "allUsers",
      targetId: "",
      scheduledAt: "",
    },
  });

  const watchAll = watch();

  const previewData = useMemo(
    () => ({
      title: watchAll.title_en || (watchAll.title_ar || (watchAll.title_fr || "Notification Title")),
      body: watchAll.body_en || (watchAll.body_ar || (watchAll.body_fr || "Tap to view details.")),
      type: watchAll.notificationType,
    }),
    [watchAll.title_en, watchAll.title_ar, watchAll.title_fr, watchAll.body_en, watchAll.body_ar, watchAll.body_fr, watchAll.notificationType]
  );

  async function onSubmit(data: NotificationFormValues) {
    if (!adminProfile) return;

    setSending(true);
    setToast(null);

    try {
      const result = await sendNotificationAction({
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
          message: data.scheduledAt
            ? "Notification scheduled."
            : "Notification sent!",
        });
        reset();
        onSent();
      } else {
        setToast({
          type: "error",
          message: result.error ?? "Failed to send notification.",
        });
      }
    } catch {
      setToast({
        type: "error",
        message: "An unexpected error occurred.",
      });
    } finally {
      setSending(false);
    }
  }

  function fieldError(field: keyof NotificationFormValues): string | undefined {
    const e = errors[field];
    return e ? (e.message as string) : undefined;
  }

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      {/* Composer */}
      <Card className="flex-1">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-text-tertiary" />
            <CardTitle>Compose Notification</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {toast && (
            <div
              className={cn(
                "mb-5 flex items-center gap-3 rounded-lg border px-4 py-3",
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
              <p className="text-body text-text-primary flex-1">
                {toast.message}
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
            {/* 3-column language layout */}
            <div className="mb-4 grid gap-4 lg:grid-cols-3">
              {/* English */}
              <div className="rounded-lg border border-border-default bg-bg-secondary p-3">
                <div className="mb-3 flex items-center gap-2">
                  <span className="text-label font-semibold text-text-primary">English</span>
                  {(errors.title_en || errors.body_en) && (
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent-red" />
                  )}
                </div>
                <div className="flex flex-col gap-3">
                  <Controller
                    name="title_en"
                    control={control}
                    render={({ field }) => {
                      const chars = (field.value ?? "").length;
                      return (
                        <div className="flex flex-col gap-1">
                          <label className="text-caption text-text-tertiary">Title</label>
                          <input
                            value={field.value ?? ""}
                            onChange={field.onChange}
                            maxLength={50}
                            placeholder='e.g. "Real Madrid vs Barcelona"'
                            className="w-full rounded-md border border-border-default bg-bg-tertiary px-3 py-2 text-body-sm text-text-primary placeholder:text-text-disabled focus:border-border-focus focus:outline-none"
                          />
                          {chars > 40 && (
                            <span className="text-caption text-text-disabled">{chars}/50</span>
                          )}
                          {fieldError("title_en") && (
                            <p className="text-caption text-accent-red">{fieldError("title_en")}</p>
                          )}
                        </div>
                      );
                    }}
                  />
                  <Controller
                    name="body_en"
                    control={control}
                    render={({ field }) => {
                      const chars = (field.value ?? "").length;
                      return (
                        <div className="flex flex-col gap-1">
                          <label className="text-caption text-text-tertiary">Body</label>
                          <textarea
                            value={field.value ?? ""}
                            onChange={field.onChange}
                            maxLength={150}
                            rows={3}
                            dir="ltr"
                            placeholder='e.g. "Kick-off in 5 min!"'
                            className="w-full resize-none rounded-md border border-border-default bg-bg-tertiary px-3 py-2 text-body-sm text-text-primary placeholder:text-text-disabled focus:border-border-focus focus:outline-none"
                          />
                          <div className="flex justify-between">
                            {fieldError("body_en") ? (
                              <p className="text-caption text-accent-red">{fieldError("body_en")}</p>
                            ) : <span />}
                            <span className={cn("text-caption", chars > 130 ? "text-accent-red" : "text-text-disabled")}>
                              {chars}/150
                            </span>
                          </div>
                        </div>
                      );
                    }}
                  />
                </div>
              </div>

              {/* Arabic */}
              <div className="rounded-lg border border-border-default bg-bg-secondary p-3">
                <div className="mb-3 flex items-center gap-2">
                  <span className="text-label font-semibold text-text-primary">Arabic</span>
                  {(errors.title_ar || errors.body_ar) && (
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent-red" />
                  )}
                </div>
                <div className="flex flex-col gap-3">
                  <Controller
                    name="title_ar"
                    control={control}
                    render={({ field }) => {
                      const chars = (field.value ?? "").length;
                      return (
                        <div className="flex flex-col gap-1">
                          <label className="text-caption text-text-tertiary">Title</label>
                          <input
                            value={field.value ?? ""}
                            onChange={field.onChange}
                            maxLength={50}
                            dir="rtl"
                            placeholder="أدخل العنوان هنا"
                            className="w-full rounded-md border border-border-default bg-bg-tertiary px-3 py-2 text-body-sm text-text-primary placeholder:text-text-disabled focus:border-border-focus focus:outline-none"
                          />
                          {chars > 40 && (
                            <span className="text-caption text-text-disabled">{chars}/50</span>
                          )}
                          {fieldError("title_ar") && (
                            <p className="text-caption text-accent-red">{fieldError("title_ar")}</p>
                          )}
                        </div>
                      );
                    }}
                  />
                  <Controller
                    name="body_ar"
                    control={control}
                    render={({ field }) => {
                      const chars = (field.value ?? "").length;
                      return (
                        <div className="flex flex-col gap-1">
                          <label className="text-caption text-text-tertiary">Body</label>
                          <textarea
                            value={field.value ?? ""}
                            onChange={field.onChange}
                            maxLength={150}
                            rows={3}
                            dir="rtl"
                            placeholder="أدخل نص الإشعار هنا"
                            className="w-full resize-none rounded-md border border-border-default bg-bg-tertiary px-3 py-2 text-body-sm text-text-primary placeholder:text-text-disabled focus:border-border-focus focus:outline-none"
                          />
                          <div className="flex justify-between">
                            {fieldError("body_ar") ? (
                              <p className="text-caption text-accent-red">{fieldError("body_ar")}</p>
                            ) : <span />}
                            <span className={cn("text-caption", chars > 130 ? "text-accent-red" : "text-text-disabled")}>
                              {chars}/150
                            </span>
                          </div>
                        </div>
                      );
                    }}
                  />
                </div>
              </div>

              {/* French */}
              <div className="rounded-lg border border-border-default bg-bg-secondary p-3">
                <div className="mb-3 flex items-center gap-2">
                  <span className="text-label font-semibold text-text-primary">French</span>
                  {(errors.title_fr || errors.body_fr) && (
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent-red" />
                  )}
                </div>
                <div className="flex flex-col gap-3">
                  <Controller
                    name="title_fr"
                    control={control}
                    render={({ field }) => {
                      const chars = (field.value ?? "").length;
                      return (
                        <div className="flex flex-col gap-1">
                          <label className="text-caption text-text-tertiary">Title</label>
                          <input
                            value={field.value ?? ""}
                            onChange={field.onChange}
                            maxLength={50}
                            placeholder='ex: "Real Madrid vs Barcelona"'
                            className="w-full rounded-md border border-border-default bg-bg-tertiary px-3 py-2 text-body-sm text-text-primary placeholder:text-text-disabled focus:border-border-focus focus:outline-none"
                          />
                          {chars > 40 && (
                            <span className="text-caption text-text-disabled">{chars}/50</span>
                          )}
                          {fieldError("title_fr") && (
                            <p className="text-caption text-accent-red">{fieldError("title_fr")}</p>
                          )}
                        </div>
                      );
                    }}
                  />
                  <Controller
                    name="body_fr"
                    control={control}
                    render={({ field }) => {
                      const chars = (field.value ?? "").length;
                      return (
                        <div className="flex flex-col gap-1">
                          <label className="text-caption text-text-tertiary">Body</label>
                          <textarea
                            value={field.value ?? ""}
                            onChange={field.onChange}
                            maxLength={150}
                            rows={3}
                            placeholder={`ex: "Coup d'envoi dans 5 min!"`}
                            className="w-full resize-none rounded-md border border-border-default bg-bg-tertiary px-3 py-2 text-body-sm text-text-primary placeholder:text-text-disabled focus:border-border-focus focus:outline-none"
                          />
                          <div className="flex justify-between">
                            {fieldError("body_fr") ? (
                              <p className="text-caption text-accent-red">{fieldError("body_fr")}</p>
                            ) : <span />}
                            <span className={cn("text-caption", chars > 130 ? "text-accent-red" : "text-text-disabled")}>
                              {chars}/150
                            </span>
                          </div>
                        </div>
                      );
                    }}
                  />
                </div>
              </div>
            </div>

              <div>
                <label className="mb-1.5 block text-label text-text-secondary">
                  Notification Type
                </label>
                <select
                  value={watch("notificationType")}
                  onChange={(e) =>
                    setValue(
                      "notificationType",
                      e.target.value as NotificationFormValues["notificationType"],
                      { shouldValidate: true }
                    )
                  }
                  className="w-full rounded-lg border border-border-default bg-bg-tertiary px-3 py-2.5 text-body text-text-primary focus:border-border-focus focus:outline-none"
                >
                  {notificationTypes.map((t) => (
                    <option key={t} value={t}>
                      {typeLabels[t]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-label text-text-secondary">
                  Target Audience
                </label>
                <select
                  value={watch("targetAudience")}
                  onChange={(e) =>
                    setValue(
                      "targetAudience",
                      e.target.value as NotificationFormValues["targetAudience"],
                      { shouldValidate: true }
                    )
                  }
                  className="w-full rounded-lg border border-border-default bg-bg-tertiary px-3 py-2.5 text-body text-text-primary focus:border-border-focus focus:outline-none"
                >
                  {audienceOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {watch("targetAudience") !== "allUsers" && (
                <Controller
                  name="targetId"
                  control={control}
                  render={({ field }) => (
                    <Input
                      label="Target ID"
                      placeholder="e.g. team-id or topic-name"
                      value={field.value ?? ""}
                      onChange={field.onChange}
                      error={fieldError("targetId")}
                      helperText="The team, match, or topic ID to target."
                    />
                  )}
                />
              )}

              <Controller
                name="scheduledAt"
                control={control}
                render={({ field }) => (
                  <Input
                    label="Schedule (optional)"
                    type="datetime-local"
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    helperText="Leave empty to send immediately."
                  />
                )}
              />

              {Object.keys(errors).length > 0 && (
                <div className="flex items-center gap-2 rounded-lg border border-accent-red/30 bg-accent-red/10 px-4 py-2.5">
                  <AlertCircle className="h-4 w-4 shrink-0 text-accent-red" />
                  <p className="text-body-sm text-accent-red">
                    {Object.entries(errors).map(([key, err]) => (
                      <span key={key} className="block">
                        {err?.message as string}
                      </span>
                    ))}
                  </p>
                </div>
              )}

              <Button
                type="submit"
                variant="primary"
                size="lg"
                disabled={sending}
                className="mt-2"
              >
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                {watch("scheduledAt") ? "Schedule" : "Send Notification"}
              </Button>
          </form>
        </CardContent>
      </Card>

      {/* Preview mockup */}
      <Card className="w-full lg:w-80 lg:shrink-0">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-text-tertiary" />
            <CardTitle>Preview</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mx-auto max-w-[260px] rounded-2xl border border-border-default bg-bg-primary p-3">
            <div className="rounded-xl bg-bg-secondary p-3.5 shadow-sm">
              <div className="mb-1 flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-accent-gold/20">
                    <Bell className="h-3.5 w-3.5 text-accent-gold" />
                  </div>
                  <span className="text-caption font-medium text-text-tertiary">
                    BigScore
                  </span>
                </div>
                <span className="text-caption text-text-disabled">Now</span>
              </div>

              <p className="text-body-sm font-semibold text-text-primary">
                {previewData.title}
              </p>
              <p className="mt-0.5 text-body-sm text-text-tertiary line-clamp-2">
                {previewData.body}
              </p>

              <p className="mt-2 text-caption text-text-disabled">
                {typeLabels[previewData.type]}
              </p>
            </div>

            <div className="mt-2 flex justify-center">
              <div className="h-1 w-20 rounded-full bg-bg-tertiary" />
            </div>
          </div>

          <p className="mt-3 text-center text-caption text-text-disabled">
            Showing English preview. Users receive the notification in their app language (EN / AR / FR).
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
