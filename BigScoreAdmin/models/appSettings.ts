export interface LiveMatchSettings {
  liveMatchesSourceMode: "manual" | "api" | "hybrid";
  enableLiveWatchButton: boolean;
  livePageStadiumMode: boolean;
  showApiSyncedBadge: boolean;
  apiProviderName: string;
  apiBaseUrl: string;
  apiKeySecretName: string;
  apiKeyMasked: string;
  syncIntervalMinutes: number;
  autoPublishApiMatches: boolean;
  allowedCompetitions: string[];
  lastSyncAt?: { seconds: number };
  lastSyncStatus: "success" | "failed" | "never";
  lastSyncError?: string;
  updatedAt?: { seconds: number };
  updatedBy?: string;
}

export interface LiveMatchSettingsStore extends LiveMatchSettings {
  apiKey?: string;
}
