import { z } from "zod";

export const liveMatchSettingsSchema = z.object({
  liveMatchesSourceMode: z.enum(["manual", "api", "hybrid"]),
  enableLiveWatchButton: z.boolean(),
  livePageStadiumMode: z.boolean(),
  showApiSyncedBadge: z.boolean(),
  apiProviderName: z.string().optional(),
  apiBaseUrl: z.string().optional(),
  apiKeySecretName: z.string().optional(),
  syncIntervalMinutes: z.coerce.number().int().min(1, "Must be at least 1 minute.").default(60),
  autoPublishApiMatches: z.boolean(),
  allowedCompetitions: z.array(z.string()).default([]),
});

export type LiveMatchSettingsFormValues = z.infer<typeof liveMatchSettingsSchema>;
