import { z } from "zod";

export const notificationTypes = [
  "matchStart",
  "goal",
  "matchEnd",
  "news",
  "announcement",
] as const;

export const audienceOptions = [
  { value: "allUsers", label: "All Users" },
  { value: "topic", label: "Topic" },
  { value: "teamFollowers", label: "Team Followers" },
  { value: "matchFollowers", label: "Match Followers" },
] as const;

export const notificationSchema = z
  .object({
    title_en: z.string().max(50, "Max 50 characters.").optional().or(z.literal("")),
    body_en: z.string().max(150, "Max 150 characters.").optional().or(z.literal("")),
    title_ar: z.string().max(50, "Max 50 characters.").optional().or(z.literal("")),
    body_ar: z.string().max(150, "Max 150 characters.").optional().or(z.literal("")),
    title_fr: z.string().max(50, "Max 50 characters.").optional().or(z.literal("")),
    body_fr: z.string().max(150, "Max 150 characters.").optional().or(z.literal("")),
    notificationType: z.enum(notificationTypes),
    targetAudience: z.enum(["allUsers", "topic", "teamFollowers", "matchFollowers"]),
    targetId: z.string().optional(),
    scheduledAt: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.targetAudience === "allUsers") return true;
      return !!data.targetId;
    },
    {
      message: "Target ID is required for this audience.",
      path: ["targetId"],
    }
  );

export type NotificationFormValues = z.infer<typeof notificationSchema>;
