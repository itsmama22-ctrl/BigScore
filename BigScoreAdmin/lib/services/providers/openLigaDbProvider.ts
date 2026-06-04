/**
 * OpenLigaDB provider adapter.
 *
 * Free public API — no API key required, no rate limits.
 * Docs: https://www.openligadb.de
 * Base URL: https://api.openligadb.de
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

export class OpenLigaDbProvider implements SportsApiProvider {
  readonly id = "openligadb";
  readonly name = "OpenLigaDB";
  readonly dailyRateLimit = 9999;

  private readonly baseUrl: string;

  private static readonly MAJOR_LEAGUES = new Set([
    "bl1", "bl2", "bl3", "dfb",
    "ucl", "uel",
    "epl", "sa", "la1",
    "wm26", "wm2026",
  ]);

  constructor(config: SportsApiProviderConfig) {
    this.baseUrl = config.baseUrl || "https://api.openligadb.de";
  }

  private async request<T>(path: string): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`);
    if (!res.ok) throw new Error(`OpenLigaDB ${res.status}`);
    return res.json() as Promise<T>;
  }

  async testConnection() {
    try {
      await this.request<unknown[]>("/getavailableleagues");
      return { success: true, message: "Connected to OpenLigaDB." };
    } catch (err) {
      return { success: false, message: err instanceof Error ? err.message : "Connection failed." };
    }
  }

  async fetchLiveResults(): Promise<ExternalMatch[]> {
    try {
      const leagues = await this.request<Array<Record<string, unknown>>>("/getavailableleagues");
      const matches: ExternalMatch[] = [];

      for (const league of leagues.slice(0, 3)) {
        try {
          const raw = await this.request<Array<Record<string, unknown>>>(
            `/getmatchdata/${String(league.leagueShortcut)}`
          );
          const live = raw
            .filter((m) => {
              const results = (m.matchResults ?? []) as Array<Record<string, unknown>>;
              return results.length > 0 || (m.matchIsFinished === false && m.matchDateTimeUTC);
            })
            .slice(0, 5);

           for (const m of live) {
             const results = (m.matchResults ?? []) as Array<Record<string, unknown>>;
             const homeResult = results.find((r: Record<string, unknown>) => r.resultOrderID === 1);

             const team1 = m.team1 as Record<string, unknown> | undefined;
             const team2 = m.team2 as Record<string, unknown> | undefined;

             matches.push({
               externalId: `olb-${m.matchID as number}`,
               sport: "Football",
               competitionName: String(m.leagueName ?? league.leagueName ?? ""),
               country: "Germany",
               homeTeamName: String(team1?.teamName ?? ""),
               awayTeamName: String(team2?.teamName ?? ""),
               startDate: m.matchDateTimeUTC ? new Date(m.matchDateTimeUTC as string) : new Date(),
               timezone: "UTC",
               status: m.matchIsFinished ? "FT" : "live",
               homeScore: homeResult ? (homeResult.pointsTeam1 as number) : undefined,
               awayScore: homeResult ? (homeResult.pointsTeam2 as number) : undefined,
               sourceType: "api",
             });
           }
        } catch { /* skip unreachable leagues */ }
      }
      return matches;
    } catch {
      return [];
    }
  }

  async fetchScheduledMatches(from: Date, to: Date): Promise<ExternalMatch[]> {
    try {
      const leagues = await this.request<Array<Record<string, unknown>>>("/getavailableleagues");

      const now = new Date();
      const currentYear = now.getFullYear();

      const targetLeagues = leagues.filter((l) => {
        const sport = l.sport as Record<string, unknown> | undefined;
        const sportName = String(sport?.sportName ?? "").toLowerCase();
        const isFootball =
          sportName === "fußball" ||
          sportName === "fussball" ||
          sportName === "football" ||
          sportName === "soccer" ||
          sportName === "frauenfußball";
        if (!isFootball) return false;

        const season = parseInt(String(l.leagueSeason ?? "0"), 10);
        if (season < currentYear - 1) return false;

        const name = String(l.leagueName ?? "").toLowerCase();
        if (name.includes("test") || name.includes("demo")) return false;

        const shortcut = String(l.leagueShortcut ?? "");
        if (OpenLigaDbProvider.MAJOR_LEAGUES.has(shortcut.toLowerCase())) return true;

        return false;
      });

      const allMatches: ExternalMatch[] = [];

      for (const league of targetLeagues) {
        const shortcut = String(league.leagueShortcut ?? "");
        if (!shortcut) continue;

        try {
          const raw = await this.request<Array<Record<string, unknown>>>(`/getmatchdata/${shortcut}`);

          for (const m of raw) {
            if (!m.matchDateTimeUTC) continue;

            const matchDate = new Date(m.matchDateTimeUTC as string);
            if (matchDate < from || matchDate > to) continue;

            const results = (m.matchResults ?? []) as Array<Record<string, unknown>>;
            const finalResult = results.find(
              (r) => r.resultOrderID === 2 || r.resultTypeID === 2
            );

            const team1 = m.team1 as Record<string, unknown> | undefined;
            const team2 = m.team2 as Record<string, unknown> | undefined;

            allMatches.push({
              externalId: `olb-${m.matchID as number}`,
              sport: "Football",
              competitionName: String(league.leagueName ?? ""),
              country: "",
              homeTeamName: String(team1?.teamName ?? ""),
              awayTeamName: String(team2?.teamName ?? ""),
              startDate: matchDate,
              timezone: "UTC",
              status: m.matchIsFinished ? "FT" : "scheduled",
              homeScore: finalResult ? (finalResult.pointsTeam1 as number) : undefined,
              awayScore: finalResult ? (finalResult.pointsTeam2 as number) : undefined,
              sourceType: "api",
            });
          }

          console.log(`[olb-scheduled] ${shortcut}: fetched ${raw.length} total, ${raw.filter((m) => {
            if (!m.matchDateTimeUTC) return false;
            const d = new Date(m.matchDateTimeUTC as string);
            return d >= from && d <= to;
          }).length} in date range`);
        } catch {
          // skip leagues that don't support match data
        }
      }

      console.log(`[olb-scheduled] Total: ${allMatches.length} matches in range`);
      return allMatches;
    } catch {
      return [];
    }
  }

  async fetchCompetitions(): Promise<ExternalCompetition[]> {
    try {
      const raw = await this.request<Array<Record<string, unknown>>>("/getavailableleagues");

      const now = new Date();
      const currentYear = now.getFullYear();

      const footballOnly = raw.filter((l) => {
        const sport = l.sport as Record<string, unknown> | undefined;
        const sportName = String(sport?.sportName ?? "").toLowerCase();
        const isFootball =
          sportName === "fußball" ||
          sportName === "fussball" ||
          sportName === "football" ||
          sportName === "soccer" ||
          sportName === "frauenfußball";
        if (!isFootball) return false;

        const season = parseInt(String(l.leagueSeason ?? "0"), 10);
        if (season < currentYear - 1) return false;

        const name = String(l.leagueName ?? "").toLowerCase();
        if (name.includes("test") || name.includes("demo")) return false;

        const shortcut = String(l.leagueShortcut ?? "");
        if (OpenLigaDbProvider.MAJOR_LEAGUES.has(shortcut.toLowerCase())) return true;

        return false;
      });

      return footballOnly.map((l) => {
        const rawName = String(l.leagueName ?? "");
        const cleanName = stripSeasonSuffix(rawName);
        const nameLower = cleanName.toLowerCase();

        let teamType: "club" | "national" = "club";
        if (nameLower.includes("world cup") ||
            nameLower.includes("euro") ||
            nameLower.includes("copa america") ||
            nameLower.includes("african cup") ||
            nameLower.includes("afcon") ||
            nameLower.includes("asian cup") ||
            nameLower.includes("nations league") ||
            nameLower.includes("gold cup") ||
            nameLower.includes("friendly") ||
            nameLower.includes("qualification")) {
          teamType = "national";
        }

        return {
          externalId: `olb-${l.leagueShortcut as string}`,
          name: cleanName,
          country: "",
          sport: "Football",
          teamType,
        };
      });
    } catch {
      return [];
    }
  }

  async fetchTeams(competitionId?: string): Promise<ExternalTeam[]> {
    if (!competitionId) return [];
    const shortcut = competitionId.replace("olb-", "");
    try {
      const currentYear = new Date().getFullYear();
      const raw = await this.request<Array<Record<string, unknown>>>(`/getavailableteams/${shortcut}/${currentYear}`);
      return raw.map((t) => ({
        externalId: `olb-t-${t.teamId as number}`,
        name: String(t.teamName ?? ""),
        shortName: String(t.shortName ?? ""),
        country: "",
        sport: "Football",
        logoUrl: (t.teamIconUrl as string) ?? undefined,
        isNational: false,
      }));
    } catch {
      return [];
    }
  }

  async fetchNationalTeams(): Promise<ExternalTeam[]> {
    return [];
  }

  async fetchNews(): Promise<ExternalNewsArticle[]> {
    return [];
  }
}
