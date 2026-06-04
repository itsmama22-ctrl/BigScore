import type { SourceType } from "@/models/shared";

// ─── External data shapes (normalized) ───────────────────────

export interface ExternalMatch {
  externalId: string;
  sport: string;
  competitionName: string;
  homeTeamName: string;
  awayTeamName: string;
  startDate: Date;
  timezone: string;
  status: string;
  homeScore?: number;
  awayScore?: number;
  currentMinute?: number;
  period?: string;
  stadium?: string;
  sourceType: SourceType;
  homeTeamId?: string;
  awayTeamId?: string;
  competitionId?: string;
  competitionLogoUrl?: string;
  homeTeamLogoUrl?: string;
  awayTeamLogoUrl?: string;
  country?: string;
  logoUrl?: string;
}

export interface ExternalCompetition {
  externalId: string;
  name: string;
  country: string;
  sport: string;
  logoUrl?: string;
  teamType?: "club" | "national";
}

export interface ExternalTeam {
  externalId: string;
  name: string;
  shortName: string;
  country: string;
  sport: string;
  logoUrl?: string;
  isNational: boolean;
}

export interface ExternalStandingTeam {
  position: number;
  externalTeamId: string;
  teamName: string;
  teamShortName: string;
  teamLogoUrl?: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}

export interface ExternalStanding {
  competitionExternalId: string;
  competitionName: string;
  season: string;
  teams: ExternalStandingTeam[];
}

/**
 * Describes whether a provider can return scheduled/future matches
 * given its current plan, tier, and coverage.
 */
export interface ScheduledMatchAvailability {
  available: boolean;
  /**
   * Machine-readable reason code:
   *  null                  – provider can serve future fixtures
   *  "free_tier_restricted" – free plan only returns narrow date window
   *  "season_ended"        – current season over, schedules not yet published
   *  "limited_coverage"    – provider only covers specific competitions
   *  "rate_limited"        – daily quota exhausted
   *  "no_provider_configured" – no future-fixtures provider set up
   *  "error"               – API call failed
   */
  reason: string | null;
  /** Human-readable explanation for display in the admin panel */
  detail: string;
}

export interface ExternalNewsArticle {
  externalId: string;
  title: string;
  summary?: string;
  body: string;
  imageUrl?: string;
  category: string;
  sourceName: string;
  sourceUrl?: string;
  publishedAt: Date;
}

// ─── Provider interface ──────────────────────────────────────

export interface SportsApiProvider {
  /** Unique identifier for this provider (e.g. "api-football", "openligadb") */
  readonly id: string;

  /** Human-readable display name */
  readonly name: string;

  /** Maximum requests per day (respected by SportsAPIManager) */
  readonly dailyRateLimit: number;

  /** Test connectivity — used from settings page */
  testConnection(): Promise<{ success: boolean; message: string }>;

  /** Fetch currently live matches (scores + status) */
  fetchLiveResults(): Promise<ExternalMatch[]>;

  /** Fetch scheduled matches for a date range */
  fetchScheduledMatches(from: Date, to: Date): Promise<ExternalMatch[]>;

  /** Fetch available competitions/leagues */
  fetchCompetitions(sport?: string): Promise<ExternalCompetition[]>;

  /** Fetch club teams for a competition */
  fetchTeams(competitionId?: string, sport?: string): Promise<ExternalTeam[]>;

  /** Fetch national teams */
  fetchNationalTeams(): Promise<ExternalTeam[]>;

  /** Fetch league standings for a competition + season */
  fetchStandings?(competitionId: string, season?: string): Promise<ExternalStanding[]>;

  /** Fetch news articles (optional — not all providers support this) */
  fetchNews?(): Promise<ExternalNewsArticle[]>;
}


// ─── Config shape passed to each provider ────────────────────

export interface SportsApiProviderConfig {
  providerId: string;
  apiKey: string;
  baseUrl: string;
}
