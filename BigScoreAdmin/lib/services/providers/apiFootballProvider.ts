/**
 * API-Football (v3) provider adapter.
 *
 * Free tier: 100 requests / day
 * Docs: https://www.api-football.com/documentation-v3
 * Base URL: https://v3.football.api-sports.io
 *
 * API key header: x-apisports-key
 */
import type {
  SportsApiProvider,
  SportsApiProviderConfig,
  ExternalMatch,
  ExternalCompetition,
  ExternalTeam,
  ExternalNewsArticle,
} from "./base";
import { stripSeasonSuffix } from "./aggregator";

export class ApiFootballProvider implements SportsApiProvider {
  readonly id = "api-football";
  readonly name = "API-Football";
  readonly dailyRateLimit = 100;

  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(config: SportsApiProviderConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || "https://v3.football.api-sports.io";
  }

  private async request<T>(path: string, params?: Record<string, string>): Promise<T> {
    const url = new URL(path, this.baseUrl);
    if (params) {
      Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    }

    const res = await fetch(url.toString(), {
      headers: {
        "x-apisports-key": this.apiKey,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      throw new Error(`API-Football ${res.status}: ${res.statusText}`);
    }

    const json = await res.json() as { errors: unknown[]; response: T };
    if (json.errors && (json.errors as unknown[]).length > 0) {
      const msgs = (json.errors as Record<string, string>[]).map((e) => e.message || JSON.stringify(e)).join(", ");
      throw new Error(`API-Football error: ${msgs}`);
    }

    return json.response;
  }

  async testConnection() {
    try {
      await this.request<unknown[]>("/status");
      return { success: true, message: "Connected to API-Football." };
    } catch (err) {
      return { success: false, message: err instanceof Error ? err.message : "Connection failed." };
    }
  }

  async fetchLiveResults(): Promise<ExternalMatch[]> {
    // Free tier: /fixtures?live=all
    // TODO: Map API response fields to ExternalMatch
    //   fixture.id → externalId
    //   teams.home.name → homeTeamName
    //   teams.away.name → awayTeamName
    //   goals.home → homeScore
    //   goals.away → awayScore
    //   fixture.status.short → status ("1H","2H","HT","FT","NS","PST","CANC")
    //   fixture.status.elapsed → currentMinute
    //   league.name → competitionName
    //   fixture.date → startDate
    //   fixture.venue.name → stadium
    try {
      const raw = await this.request<unknown[]>("/fixtures", { live: "all" });
      return this.mapMatches(raw as Record<string, unknown>[]);
    } catch {
      return [];
    }
  }

   async fetchScheduledMatches(from: Date, to: Date): Promise<ExternalMatch[]> {
     // Free tier: /fixtures?date=YYYY-MM-DD (single date only)
     // Paid tier: supports /fixtures?from=...&to=...

     const fromStr = from.toISOString().slice(0, 10);
     const toStr = to.toISOString().slice(0, 10);

     if (fromStr === toStr) {
       try {
         const raw = await this.request<unknown[]>("/fixtures", { date: fromStr });
         return this.mapMatches(raw as Record<string, unknown>[]);
       } catch {
         return [];
       }
     }

     try {
       const raw = await this.request<unknown[]>("/fixtures", {
         from: fromStr,
         to: toStr,
       });
       const results = this.mapMatches(raw as Record<string, unknown>[]);
       if (results.length > 0) {
         console.log(`[api-football] from/to returned ${results.length} matches (paid tier)`);
         return results;
       }
     } catch (e) {
       console.log(`[api-football] from/to failed (likely free tier), falling back to individual dates: ${e}`);
     }

      const dayMs = 24 * 60 * 60 * 1000;
      const allResults: ExternalMatch[] = [];
      const maxDays = 3;

      let current = new Date(from);
      let daysFetched = 0;

      while (current <= to && daysFetched < maxDays) {
       const dateStr = current.toISOString().slice(0, 10);
       try {
         console.log(`[api-football] fetching single date: ${dateStr}`);
         const raw = await this.request<unknown[]>("/fixtures", { date: dateStr });
         const matches = this.mapMatches(raw as Record<string, unknown>[]);
         console.log(`[api-football] ${dateStr}: ${matches.length} matches`);
         allResults.push(...matches);
       } catch (e) {
         console.warn(`[api-football] failed to fetch ${dateStr}: ${e}`);
       }
       current = new Date(current.getTime() + dayMs);
       daysFetched++;
     }

     return allResults;
   }

  async fetchCompetitions(): Promise<ExternalCompetition[]> {
    try {
      const raw = await this.request<unknown[]>("/leagues");
      return ((raw as Record<string, unknown>[]) ?? []).map((item) => {
        const league = (item.league ?? {}) as Record<string, unknown>;
        const country = (item.country ?? {}) as Record<string, unknown>;
        const rawName = String(league.name ?? "");
        const cleanName = stripSeasonSuffix(rawName);
        const leagueType = (league.type as string) || "";
        const teamType = leagueType === "League" || leagueType === "Cup" 
          ? "club" 
          : leagueType === "National Team" 
            ? "national" 
            : undefined;
        return {
          externalId: String(league.id ?? ""),
          name: cleanName,
          country: String(country.name ?? ""),
          sport: "Football",
          logoUrl: (league.logo as string) ?? undefined,
          teamType,
        };
      });
    } catch (err) {
      console.error("[api-football] fetchCompetitions failed:", err);
      return [];
    }
  }

  async fetchTeams(competitionId?: string): Promise<ExternalTeam[]> {
    const params: Record<string, string> = {};
    if (competitionId) { params.league = competitionId; params.season = "2024"; }

    try {
      const raw = await this.request<unknown[]>("/teams", params);
      console.log(`[api-football] /teams?${new URLSearchParams(params).toString()} returned ${(raw as unknown[])?.length ?? 0} items`);
      return ((raw as Record<string, unknown>[]) ?? []).map((item) => {
        const team = (item.team ?? {}) as Record<string, unknown>;
        return {
          externalId: String(team.id ?? ""),
          name: String(team.name ?? ""),
          shortName: String(team.code ?? team.name ?? "").substring(0, 10),
          country: String(team.country ?? ""),
          sport: "Football",
          logoUrl: (team.logo as string) ?? undefined,
          isNational: Boolean(team.national),
        };
      });
    } catch {
      return [];
    }
  }

  async fetchNationalTeams(): Promise<ExternalTeam[]> {
    // API-Football doesn't have a dedicated national teams endpoint.
    // Fetch teams from major international competitions instead.
    const NATIONAL_COMPETITIONS = [
      { id: "1", season: "2022" },   // FIFA World Cup 2022
      { id: "4", season: "2024" },   // Euro 2024
      { id: "9", season: "2024" },   // Copa America 2024
      { id: "6", season: "2023" },   // AFCON 2023
      { id: "10", season: "2023" },  // Asian Cup 2023
    ];

    const allTeams: Map<string, ExternalTeam> = new Map();

    for (const comp of NATIONAL_COMPETITIONS) {
      try {
        const raw = await this.request<unknown[]>("/teams", { league: comp.id, season: comp.season });
        for (const item of (raw as Record<string, unknown>[]) ?? []) {
          const team = (item.team ?? {}) as Record<string, unknown>;
          const isNational = Boolean(team.national);
          const extId = String(team.id ?? "");

          if (isNational && extId && !allTeams.has(extId)) {
            allTeams.set(extId, {
              externalId: extId,
              name: String(team.name ?? ""),
              shortName: String(team.code ?? team.name ?? "").substring(0, 10),
              country: String(team.country ?? ""),
              sport: "Football",
              logoUrl: (team.logo as string) ?? undefined,
              isNational: true,
            });
          }
        }
      } catch (err) {
        console.warn(`[api-football] fetchNationalTeams failed for league=${comp.id}:`, err);
      }
    }

    return Array.from(allTeams.values());
  }

  /** API-Football doesn't have a news endpoint — return empty */
  async fetchNews(): Promise<ExternalNewsArticle[]> {
    return [];
  }

   private mapMatches(items: Record<string, unknown>[]): ExternalMatch[] {
     if (!Array.isArray(items)) return [];

     return items.map((item) => {
       const fixture = (item.fixture ?? {}) as Record<string, unknown>;
       const teams = (item.teams ?? {}) as Record<string, unknown>;
       const home = (teams.home ?? {}) as Record<string, unknown>;
       const away = (teams.away ?? {}) as Record<string, unknown>;
       const goals = (item.goals ?? {}) as Record<string, unknown>;
       const league = (item.league ?? {}) as Record<string, unknown>;
       const venue = (fixture.venue ?? {}) as Record<string, unknown>;
       const status = (fixture.status ?? {}) as Record<string, unknown>;

       const homeTeamId = home.id ? String(home.id) : undefined;
       const awayTeamId = away.id ? String(away.id) : undefined;
       const competitionId = league.id ? String(league.id) : undefined;

       return {
         externalId: `apif-${String(fixture.id ?? "")}`,
         sport: "Football",
         competitionId: competitionId,
         competitionName: String(league.name ?? ""),
         country: String(league.country ?? ""),
         competitionLogoUrl: (league.logo as string) ?? undefined,
         homeTeamId: homeTeamId,
         homeTeamName: String(home.name ?? ""),
         homeTeamLogoUrl: (home.logo as string) ?? undefined,
         awayTeamId: awayTeamId,
         awayTeamName: String(away.name ?? ""),
         awayTeamLogoUrl: (away.logo as string) ?? undefined,
         startDate: fixture.date ? new Date(fixture.date as string) : new Date(),
         timezone: (fixture.timezone as string) ?? "UTC",
         status: String(status.short ?? "NS"),
         homeScore: (goals.home as number) ?? undefined,
         awayScore: (goals.away as number) ?? undefined,
         currentMinute: (status.elapsed as number) ?? undefined,
         period: undefined,
         stadium: (venue.name as string) ?? undefined,
         sourceType: "api",
       };
     });
   }

  async fetchStandings(competitionId: string, season?: string): Promise<import("./base").ExternalStanding[]> {
    const s = season ?? String(new Date().getFullYear());
    try {
      const raw = await this.request<unknown[]>("/standings", { league: competitionId, season: s });
      return ((raw as Record<string, unknown>[]) ?? []).map((item) => {
        const league = (item.league ?? {}) as Record<string, unknown>;
        const entries = ((league.standings as unknown[])?.flatMap(
          (g: unknown) => (g as unknown[]) ?? []
        ) ?? []) as Record<string, unknown>[];
        return {
          competitionExternalId: String(league.id ?? competitionId),
          competitionName: String(league.name ?? ""),
          season: String(league.season ?? s),
          teams: entries.map((e: Record<string, unknown>) => {
            const allStats = (e.all as Record<string, unknown>) ?? {};
            const goalsStats = (allStats.goals as Record<string, unknown>) ?? {};
            return {
            position: Number(e.rank ?? 0),
            externalTeamId: String(((e.team as Record<string, unknown>) ?? {}).id ?? ""),
            teamName: String(((e.team as Record<string, unknown>) ?? {}).name ?? ""),
            teamShortName: String((((e.team as Record<string, unknown>) ?? {}).name as string ?? "").substring(0, 3).toUpperCase()),
            teamLogoUrl: String(((e.team as Record<string, unknown>) ?? {}).logo ?? ""),
            played: Number(allStats.played ?? 0),
            won: Number(allStats.win ?? 0),
            drawn: Number(allStats.draw ?? 0),
            lost: Number(allStats.lose ?? 0),
            goalsFor: Number(goalsStats.for ?? 0),
            goalsAgainst: Number(goalsStats.against ?? 0),
            goalDifference: Number(e.goalsDiff ?? 0),
            points: Number(e.points ?? 0),
          };
          }),
        };
      });
    } catch {
      return [];
    }
  }
}
