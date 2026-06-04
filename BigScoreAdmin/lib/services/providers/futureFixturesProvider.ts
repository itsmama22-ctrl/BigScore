import type { ExternalMatch } from "./base";

/**
 * Interface for a provider that can supply upcoming/future scheduled matches.
 * Separate from SportsApiProvider so a paid future-fixtures source
 * (e.g. API-Football paid tier, TheSportsDB paid) can be plugged in
 * without refactoring the existing live-match providers.
 */
export interface FutureFixturesProvider {
  readonly id: string;
  readonly name: string;
  readonly dailyRateLimit: number;

  fetchScheduledMatches(from: Date, to: Date): Promise<ExternalMatch[]>;

  getAvailability(): Promise<{
    available: boolean;
    reason: string | null;
    detail: string;
  }>;

  testConnection(): Promise<{ success: boolean; message: string }>;
}

/**
 * Placeholder that always reports "not configured".
 * Swap this with a real implementation when a paid future-fixtures
 * source is available.
 */
export class NoopFutureFixturesProvider implements FutureFixturesProvider {
  readonly id = "future-fixtures-placeholder";
  readonly name = "No Future Fixtures Provider";
  readonly dailyRateLimit = 9999;

  async fetchScheduledMatches(): Promise<ExternalMatch[]> {
    return [];
  }

  async getAvailability() {
    return {
      available: false,
      reason: "no_provider_configured" as const,
      detail:
        "No future-fixtures provider is configured. To show upcoming matches " +
        "beyond current provider limits, add a paid API key (e.g. API-Football " +
        "paid tier) or implement a custom FutureFixturesProvider in " +
        "lib/services/providers/futureFixturesProvider.ts",
    };
  }

  async testConnection() {
    return { success: false, message: "No future-fixtures provider configured." };
  }
}
