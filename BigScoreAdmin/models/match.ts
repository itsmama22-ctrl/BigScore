import type { SourceMetadata, ManualOverrides } from "./shared";

export interface Stream {
  /** ISO 639-1 language code (e.g. "en", "es", "ar") - iOS-compatible field name */
  language?: string;

  /** @deprecated Use language instead - old admin field name */
  languageCode?: string;

  /** Human-readable label (e.g. "English", "Spanish", "Arabic") */
  label: string;

  /** Stream URL */
  url: string;

  /** Whether this stream is active - iOS-compatible field name */
  isEnabled?: boolean;

  /** @deprecated Use isEnabled instead - old admin field name */
  enabled?: boolean;

  /** Display order (lower = first) */
  order: number;

  /** Optional quality hint */
  quality?: "auto" | "1080p" | "720p" | "480p";
}

export type MatchStatus =
  | "scheduled"
  | "live"
  | "halftime"
  | "finished"
  | "postponed"
  | "cancelled";

export type LicenseStatus =
  | "verified"
  | "pending"
  | "expired"
  | "not_required";

export type StreamQuality = "auto" | "1080p" | "720p" | "480p";

// ─── Match (backward-compatible — all existing fields preserved) ──

export interface Match {
  id: string;
  sport: string;
  competitionId: string;
  competitionName: string;
  competitionLogoUrl?: string;
  homeTeamId: string;
  homeTeamName: string;
  homeTeamLogoUrl?: string;
  awayTeamId: string;
  awayTeamName: string;
  awayTeamLogoUrl?: string;
  stadium?: string;
  venueDisplayText?: string;
  startDate: { seconds: number };
  startTime: { seconds: number };
  timezone: string;
  status: MatchStatus;
  homeScore?: number;
  scoreHome?: number;
  awayScore?: number;
  scoreAway?: number;
  currentMinute?: number;
  minute?: number;
  period?: string;
  venue?: string;
  enableWatchMode: boolean;
  streamUrl?: string;
  streamProvider?: string;
  streamQuality: StreamQuality;
  streams: Stream[];
  licenseStatus?: LicenseStatus;
  licenseExpiresAt?: { seconds: number };
  isPublished: boolean;
  isActive: boolean;
  sourceType: "manual" | "api" | "hybrid";
  externalApiMatchId?: string;
  adminOverrideFields?: Record<string, boolean>;
  displayOrder: number;
  source: SourceMetadata;
  manualOverrides: ManualOverrides;
  createdAt: { seconds: number };
  updatedAt: { seconds: number };
  createdBy: string;
  updatedBy?: string;
}
