export type SyncStatus = "running" | "success" | "failed" | "partial";

export interface SyncLog {
  id: string;
  provider: string;
  syncType: "live" | "scheduled" | "competitions" | "teams" | "nationalTeams";
  startedAt: { seconds: number };
  finishedAt: { seconds: number } | null;
  status: SyncStatus;
  requestCount: number;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  errorMessage?: string;
}

export interface ApiProviderUsage {
  id: string;
  provider: string;
  date: string;
  requestCount: number;
  lastUpdatedAt: { seconds: number };
}
