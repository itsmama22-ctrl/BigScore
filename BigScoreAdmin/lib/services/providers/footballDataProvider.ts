/**
 * Football-Data.org provider adapter.
 *
 * Free tier: 10 requests / minute
 * Docs: https://www.football-data.org/documentation/quickstart
 * Base URL: https://api.football-data.org/v4
 *
 * Auth: X-Auth-Token header
 */
import type {
  SportsApiProvider,
  SportsApiProviderConfig,
  ExternalMatch,
  ExternalCompetition,
  ExternalTeam,
  ExternalNewsArticle,
} from "./base";

export class FootballDataProvider implements SportsApiProvider {
  readonly id = "football-data";
  readonly name = "Football-Data.org";
  readonly dailyRateLimit = 1440;

  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(config: SportsApiProviderConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || "https://api.football-data.org/v4";
  }

  private async request<T>(path: string): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      headers: { "X-Auth-Token": this.apiKey },
    });

    if (!res.ok) {
      if (res.status === 429) throw new Error("Football-Data.org rate limit exceeded.");
      throw new Error(`Football-Data.org ${res.status}`);
    }

    return res.json() as Promise<T>;
  }

  async testConnection() {
    try {
      await this.request<Record<string, unknown>>("/competitions");
      return { success: true, message: "Connected to Football-Data.org." };
    } catch (err) {
      return { success: false, message: err instanceof Error ? err.message : "Connection failed." };
    }
  }

  async fetchLiveResults(): Promise<ExternalMatch[]> {
    try {
      const raw = await this.request<{ matches: Array<Record<string, unknown>> }>("/matches?status=LIVE");
      return this.mapMatches(raw.matches ?? []);
    } catch {
      return [];
    }
  }

  async fetchScheduledMatches(from: Date, to: Date): Promise<ExternalMatch[]> {
    const dateFrom = from.toISOString().slice(0, 10);
    const dateTo = to.toISOString().slice(0, 10);
    try {
      const raw = await this.request<{ matches: Array<Record<string, unknown>> }>(
        `/matches?dateFrom=${dateFrom}&dateTo=${dateTo}`
      );
      return this.mapMatches(raw.matches ?? []);
    } catch {
      return [];
    }
  }

  async fetchCompetitions(): Promise<ExternalCompetition[]> {
    try {
      const raw = await this.request<{ competitions: Array<Record<string, unknown>> }>("/competitions");
      return (raw.competitions ?? []).map((c) => {
        const area = (c.area ?? {}) as Record<string, unknown>;
        return {
          externalId: `fd-${c.id as number}`,
          name: String(c.name ?? ""),
          country: String(area.name ?? ""),
          sport: "Football",
          logoUrl: (c.emblem as string) ?? undefined,
        };
      });
    } catch {
      return [];
    }
  }

  async fetchTeams(competitionId?: string): Promise<ExternalTeam[]> {
    if (!competitionId) return [];
    const id = competitionId.replace("fd-", "");
    try {
      const raw = await this.request<{ teams: Array<Record<string, unknown>> }>(`/competitions/${id}/teams`);
      return (raw.teams ?? []).map((t) => ({
        externalId: `fd-t-${t.id as number}`,
        name: String(t.name ?? ""),
        shortName: String(t.shortName ?? t.tla ?? ""),
        country: String((t.area as Record<string, unknown>)?.name ?? ""),
        sport: "Football",
        logoUrl: (t.crest as string) ?? undefined,
        isNational: false,
      }));
    } catch {
      return [];
    }
  }

  /**
   * Football-Data.org doesn't separate national teams from club teams.
   * Use area/country-based query if needed.
   */
  async fetchNationalTeams(): Promise<ExternalTeam[]> {
    // The free tier doesn't support national team queries directly.
    // You'd need a separate plan or combine with another provider.
    return [];
  }

  async fetchNews(): Promise<ExternalNewsArticle[]> {
    return [];
  }

  private mapMatches(items: Array<Record<string, unknown>>): ExternalMatch[] {
    if (!Array.isArray(items)) return [];

    return items.map((m) => {
      const homeTeam = (m.homeTeam ?? {}) as Record<string, unknown>;
      const awayTeam = (m.awayTeam ?? {}) as Record<string, unknown>;
      const score = (m.score ?? {}) as Record<string, unknown>;
      const fullTime = (score.fullTime ?? {}) as Record<string, unknown>;
      const competition = (m.competition ?? {}) as Record<string, unknown>;

      return {
        externalId: `fd-${m.id as number}`,
        sport: "Football",
        competitionName: String(competition.name ?? ""),
        homeTeamName: String(homeTeam.name ?? ""),
        awayTeamName: String(awayTeam.name ?? ""),
        startDate: m.utcDate ? new Date(m.utcDate as string) : new Date(),
        timezone: "UTC",
        status: String(m.status ?? "SCHEDULED"),
        homeScore: (fullTime.home as number) ?? undefined,
        awayScore: (fullTime.away as number) ?? undefined,
        currentMinute: (m.minute as number) ?? undefined,
        sourceType: "api",
      };
    });
  }
}
