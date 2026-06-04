import { z } from "zod";

export const channelSchema = z.object({
  name: z.string().min(1, "Channel name is required."),
  logoUrl: z.string().optional(),
  streamUrl: z.string().min(1, "Stream URL is required.").url("Must be a valid URL."),
  streamProvider: z.string().optional(),
  quality: z.enum(["auto", "1080p", "720p", "480p"]),
  isActive: z.boolean(),
  displayOrder: z.coerce.number().int().min(0, "Must be a positive number."),
  licenseStatus: z.enum(["verified", "pending", "expired"]),
  licenseExpiresAt: z.string().optional(),
});

export type ChannelFormValues = z.infer<typeof channelSchema>;

export const packageSchema = z.object({
  name: z.string().min(1, "Package name is required.").max(50, "Max 50 characters."),
  description: z.string().max(200, "Max 200 characters.").optional(),
  category: z.enum(["Football", "Basketball", "Tennis", "Other"]),
  isActive: z.boolean(),
  displayOrder: z.coerce.number().int().min(0, "Must be 0 or higher."),
  imageUrl: z.string().min(1, "Package image is required."),
  licenseNotes: z.string().optional(),
});

export type PackageFormValues = z.infer<typeof packageSchema>;
