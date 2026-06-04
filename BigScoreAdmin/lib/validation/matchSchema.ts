import { z } from "zod";

export const sourceTypes = ["manual", "api", "hybrid"] as const;
export type SourceType = (typeof sourceTypes)[number];

export const matchStatuses = [
  "scheduled",
  "live",
  "halftime",
  "finished",
  "postponed",
  "cancelled",
] as const;

export const matchSchema = z
  .object({
    competitionId: z.string().min(1, "Competition is required."),
    sport: z.string().min(1, "Sport is required."),
    homeTeamId: z.string().min(1, "Home team is required."),
    awayTeamId: z.string().min(1, "Away team is required."),
    stadium: z.string().optional(),
    venueDisplayText: z.string().optional(),
    startDate: z.string().min(1, "Date and time is required."),
    timezone: z.string().optional(),
    status: z.enum(matchStatuses),
    homeScore: z.coerce.number().int().min(0, "Scores must be non-negative.").optional(),
    awayScore: z.coerce.number().int().min(0, "Scores must be non-negative.").optional(),
    currentMinute: z.coerce.number().int().min(0).optional(),
    period: z.string().optional(),
    enableWatchMode: z.boolean(),
    streamUrl: z
      .union([z.literal(""), z.string().url("Stream URL must be a valid URL.")])
      .optional()
      .transform((v) => (v === "" ? undefined : v)),
    streamProvider: z.string().optional(),
    streamQuality: z.enum(["auto", "1080p", "720p", "480p"]),
    licenseStatus: z.enum(["verified", "pending", "expired", "not_required"]).optional(),
    licenseExpiresAt: z.string().optional(),
    isPublished: z.boolean(),
    isActive: z.boolean(),
    sourceType: z.enum(sourceTypes),
    externalApiMatchId: z.string().optional(),
    displayOrder: z.coerce.number().int(),
    streams: z.array(
      z.object({
        language: z.string().min(1),
        label: z.string().min(1),
        url: z.string(),
        isEnabled: z.boolean(),
        order: z.coerce.number().int().min(0),
        quality: z.enum(["auto", "1080p", "720p", "480p"]).optional(),
      })
    ),
  })
  .refine((data) => data.homeTeamId !== data.awayTeamId, {
    message: "Home team and away team must be different.",
    path: ["awayTeamId"],
  })
  .refine((data) => {
    if (!data.enableWatchMode) return true;
    if (data.streamUrl) return true;
    return data.streams.some((s) => s.isEnabled && s.url.trim().length > 0);
  }, {
    message: "Stream URL or at least one enabled stream link is required when watch mode is enabled.",
    path: ["streamUrl"],
  })
  .refine((data) => !data.streamUrl || !!data.licenseStatus, {
    message: "License status is required when a stream URL is provided.",
    path: ["licenseStatus"],
  })
  .refine(
    (data) => {
      for (const stream of data.streams) {
        if (stream.isEnabled) {
          if (!stream.url || stream.url.trim() === "") {
            return false;
          }
          try {
            new URL(stream.url);
          } catch {
            return false;
          }
        }
      }
      return true;
    },
    {
      message: "Enabled streams require a valid URL.",
      path: ["streams"],
    }
  )
  .refine(
    (data) => {
      if (!data.enableWatchMode || !data.streamUrl) return true;
      if (data.licenseStatus !== "expired") return true;
      return false;
    },
    {
      message: "Cannot publish a watch-enabled match with an expired license.",
      path: ["licenseStatus"],
    }
  );

export interface MatchFormValues {
  competitionId: string;
  sport: string;
  homeTeamId: string;
  awayTeamId: string;
  stadium?: string;
  venueDisplayText?: string;
  startDate: string;
  timezone?: string;
  status: (typeof matchStatuses)[number];
  homeScore?: number;
  awayScore?: number;
  currentMinute?: number;
  period?: string;
  enableWatchMode: boolean;
  streamUrl?: string;
  streamProvider?: string;
  streamQuality: "auto" | "1080p" | "720p" | "480p";
  licenseStatus?: "verified" | "pending" | "expired" | "not_required";
  licenseExpiresAt?: string;
  isPublished: boolean;
  isActive: boolean;
  sourceType: SourceType;
  externalApiMatchId?: string;
  displayOrder: number;
  streams: Array<{
    language: string;
    label: string;
    url: string;
    isEnabled: boolean;
    order: number;
    quality?: "auto" | "1080p" | "720p" | "480p";
  }>;
}
