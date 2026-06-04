import type { SportsApiProvider, SportsApiProviderConfig, ExternalMatch, ExternalCompetition, ExternalTeam, ExternalNewsArticle } from "./base";

/**
 * Development mock provider — returns simulated data.
 * Always connected, never rate-limited.
 */
export class MockSportsApiProvider implements SportsApiProvider {
  readonly id = "mock";
  readonly name = "Mock Provider (Dev)";
  readonly dailyRateLimit = 9999;

  constructor(_config: SportsApiProviderConfig) {}

  async testConnection() {
    return { success: true, message: "Mock provider is always connected." };
  }

  async fetchLiveResults(): Promise<ExternalMatch[]> {
    const now = Date.now();
    return [
      {
        externalId: "mock-live-001", sport: "Football", competitionName: "Premier League", country: "England",
        homeTeamName: "Arsenal", awayTeamName: "Chelsea", startDate: new Date(now - 45 * 60000),
        timezone: "UTC", status: "live", homeScore: 2, awayScore: 1, currentMinute: 47,
        period: "2nd Half", stadium: "Emirates Stadium", sourceType: "api",
      },
      {
        externalId: "mock-live-002", sport: "Football", competitionName: "La Liga", country: "Spain",
        homeTeamName: "Barcelona", awayTeamName: "Real Madrid", startDate: new Date(now - 30 * 60000),
        timezone: "UTC", status: "live", homeScore: 1, awayScore: 1, currentMinute: 33,
        period: "1st Half", stadium: "Camp Nou", sourceType: "api",
      },
    ];
  }

  async fetchScheduledMatches(fromDate?: Date, toDate?: Date): Promise<ExternalMatch[]> {
    const now = Date.now();
    const from = fromDate ? fromDate.getTime() : now;
    const to = toDate ? toDate.getTime() : now + 7 * 24 * 60 * 60000;

    const clubMatches = [
      { home: "Manchester City", away: "Liverpool", comp: "Premier League", country: "England" },
      { home: "Arsenal", away: "Chelsea", comp: "Premier League", country: "England" },
      { home: "Manchester United", away: "Tottenham", comp: "Premier League", country: "England" },
      { home: "Newcastle", away: "Aston Villa", comp: "Premier League", country: "England" },
      { home: "Barcelona", away: "Real Madrid", comp: "La Liga", country: "Spain" },
      { home: "Atletico Madrid", away: "Sevilla", comp: "La Liga", country: "Spain" },
      { home: "Real Sociedad", away: "Villarreal", comp: "La Liga", country: "Spain" },
      { home: "Juventus", away: "AC Milan", comp: "Serie A", country: "Italy" },
      { home: "Inter Milan", away: "Napoli", comp: "Serie A", country: "Italy" },
      { home: "AS Roma", away: "Lazio", comp: "Serie A", country: "Italy" },
      { home: "Bayern Munich", away: "Dortmund", comp: "Bundesliga", country: "Germany" },
      { home: "RB Leipzig", away: "Bayer Leverkusen", comp: "Bundesliga", country: "Germany" },
      { home: "Union Berlin", away: "Frankfurt", comp: "Bundesliga", country: "Germany" },
      { home: "PSG", away: "Marseille", comp: "Ligue 1", country: "France" },
      { home: "Monaco", away: "Lyon", comp: "Ligue 1", country: "France" },
      { home: "Ajax", away: "Feyenoord", comp: "Eredivisie", country: "Netherlands" },
      { home: "Benfica", away: "Porto", comp: "Primeira Liga", country: "Portugal" },
      { home: "Fenerbahce", away: "Galatasaray", comp: "Süper Lig", country: "Turkey" },
      { home: "Al Hilal", away: "Al Nassr", comp: "Saudi Pro League", country: "Saudi-Arabia" },
      { home: "Flamengo", away: "Palmeiras", comp: "Brasileirão", country: "Brazil" },
      { home: "Boca Juniors", away: "River Plate", comp: "Liga Profesional Argentina", country: "Argentina" },
      { home: "LA Galaxy", away: "Inter Miami", comp: "Major League Soccer", country: "USA" },
      { home: "Club America", away: "Chivas", comp: "Liga MX", country: "Mexico" },
    ];

    const nationalMatches = [
      { home: "England", away: "France", comp: "UEFA Euro", country: "Europe" },
      { home: "Spain", away: "Germany", comp: "UEFA Euro", country: "Europe" },
      { home: "Italy", away: "Portugal", comp: "UEFA Euro", country: "Europe" },
      { home: "Netherlands", away: "Belgium", comp: "UEFA Euro", country: "Europe" },
      { home: "Brazil", away: "Argentina", comp: "Copa America", country: "South America" },
      { home: "Uruguay", away: "Colombia", comp: "Copa America", country: "South America" },
      { home: "Senegal", away: "Morocco", comp: "African Cup of Nations", country: "Africa" },
      { home: "Egypt", away: "Nigeria", comp: "African Cup of Nations", country: "Africa" },
      { home: "Japan", away: "South Korea", comp: "AFC Asian Cup", country: "Asia" },
      { home: "Saudi Arabia", away: "Australia", comp: "AFC Asian Cup", country: "Asia" },
      { home: "England", away: "Brazil", comp: "FIFA World Cup", country: "World" },
      { home: "France", away: "Argentina", comp: "FIFA World Cup", country: "World" },
      { home: "Spain", away: "Germany", comp: "FIFA World Cup", country: "World" },
    ];

    const clubUclMatches = [
      { home: "Manchester City", away: "Real Madrid", comp: "UEFA Champions League", country: "World" },
      { home: "Bayern Munich", away: "Barcelona", comp: "UEFA Champions League", country: "World" },
      { home: "PSG", away: "Inter Milan", comp: "UEFA Champions League", country: "World" },
      { home: "Arsenal", away: "Juventus", comp: "UEFA Champions League", country: "World" },
      { home: "Liverpool", away: "Atletico Madrid", comp: "UEFA Europa League", country: "World" },
      { home: "Manchester United", away: "Roma", comp: "UEFA Europa League", country: "World" },
      { home: "Flamengo", away: "Palmeiras", comp: "Copa Libertadores", country: "World" },
      { home: "Boca Juniors", away: "River Plate", comp: "Copa Libertadores", country: "World" },
    ];

    const allMatchTemplates = [...clubMatches, ...nationalMatches, ...clubUclMatches];

    const results: ExternalMatch[] = [];
    const dayMs = 24 * 60 * 60000;
    const startOfFrom = new Date(from);
    startOfFrom.setHours(0, 0, 0, 0);

    let idx = 0;
    for (let dayOffset = 0; dayOffset <= 7; dayOffset++) {
      const dayStart = startOfFrom.getTime() + dayOffset * dayMs;
      if (dayStart > to) continue;

      const matchesPerDay = 4 + (dayOffset === 0 ? 2 : 0);

      for (let i = 0; i < matchesPerDay && idx < allMatchTemplates.length * 3; i++) {
        const t = allMatchTemplates[idx % allMatchTemplates.length];
        const hour = 15 + (i % 4) * 2;
        const matchTime = dayStart + hour * 60 * 60000 + (i * 30 * 60000);

        if (matchTime >= from && matchTime <= to) {
          results.push({
            externalId: `mock-sched-${dayOffset}-${i}`,
            sport: "Football",
            competitionName: t.comp,
            country: t.country,
            homeTeamName: t.home,
            awayTeamName: t.away,
            startDate: new Date(matchTime),
            timezone: "UTC",
            status: "scheduled",
            sourceType: "api",
          });
        }
        idx++;
      }
    }

    return results;
  }

  async fetchCompetitions(): Promise<ExternalCompetition[]> {
    return [
      { externalId: "mock-comp-int-001", name: "FIFA World Cup", country: "World", sport: "Football", teamType: "national" },
      { externalId: "mock-comp-int-002", name: "UEFA Euro", country: "Europe", sport: "Football", teamType: "national" },
      { externalId: "mock-comp-int-003", name: "Copa America", country: "South America", sport: "Football", teamType: "national" },
      { externalId: "mock-comp-int-004", name: "African Cup of Nations", country: "Africa", sport: "Football", teamType: "national" },
      { externalId: "mock-comp-int-005", name: "AFC Asian Cup", country: "Asia", sport: "Football", teamType: "national" },
      { externalId: "mock-comp-int-006", name: "UEFA Champions League", country: "Europe", sport: "Football", teamType: "club" },
      { externalId: "mock-comp-int-007", name: "UEFA Europa League", country: "Europe", sport: "Football", teamType: "club" },
      { externalId: "mock-comp-int-008", name: "UEFA Conference League", country: "Europe", sport: "Football", teamType: "club" },
      { externalId: "mock-comp-int-009", name: "Copa Libertadores", country: "South America", sport: "Football", teamType: "club" },
      { externalId: "mock-comp-int-010", name: "FIFA Club World Cup", country: "World", sport: "Football", teamType: "club" },
      { externalId: "mock-comp-001", name: "Premier League", country: "England", sport: "Football", teamType: "club" },
      { externalId: "mock-comp-002", name: "La Liga", country: "Spain", sport: "Football", teamType: "club" },
      { externalId: "mock-comp-003", name: "Serie A", country: "Italy", sport: "Football", teamType: "club" },
      { externalId: "mock-comp-004", name: "Bundesliga", country: "Germany", sport: "Football", teamType: "club" },
      { externalId: "mock-comp-005", name: "Ligue 1", country: "France", sport: "Football", teamType: "club" },
      { externalId: "mock-comp-007", name: "Eredivisie", country: "Netherlands", sport: "Football", teamType: "club" },
      { externalId: "mock-comp-008", name: "Primeira Liga", country: "Portugal", sport: "Football", teamType: "club" },
      { externalId: "mock-comp-009", name: "Süper Lig", country: "Turkey", sport: "Football", teamType: "club" },
      { externalId: "mock-comp-010", name: "Brasileirão", country: "Brazil", sport: "Football", teamType: "club" },
      { externalId: "mock-comp-011", name: "Liga Profesional Argentina", country: "Argentina", sport: "Football", teamType: "club" },
      { externalId: "mock-comp-012", name: "Major League Soccer", country: "USA", sport: "Football", teamType: "club" },
      { externalId: "mock-comp-013", name: "Liga MX", country: "Mexico", sport: "Football", teamType: "club" },
      { externalId: "mock-comp-014", name: "Saudi Pro League", country: "Saudi-Arabia", sport: "Football", teamType: "club" },
      { externalId: "mock-comp-006", name: "NBA", country: "USA", sport: "Basketball", teamType: "club" },
    ];
  }

  async fetchTeams(): Promise<ExternalTeam[]> {
    return [
      { externalId: "mock-t-001", name: "Arsenal", shortName: "ARS", country: "England", sport: "Football", isNational: false },
      { externalId: "mock-t-002", name: "Chelsea", shortName: "CHE", country: "England", sport: "Football", isNational: false },
      { externalId: "mock-t-003", name: "Manchester United", shortName: "MUN", country: "England", sport: "Football", isNational: false },
      { externalId: "mock-t-004", name: "Liverpool", shortName: "LIV", country: "England", sport: "Football", isNational: false },
      { externalId: "mock-t-005", name: "Manchester City", shortName: "MCI", country: "England", sport: "Football", isNational: false },
      { externalId: "mock-t-006", name: "Barcelona", shortName: "BAR", country: "Spain", sport: "Football", isNational: false },
      { externalId: "mock-t-007", name: "Real Madrid", shortName: "RMA", country: "Spain", sport: "Football", isNational: false },
    ];
  }

  async fetchNationalTeams(): Promise<ExternalTeam[]> {
    return [
      { externalId: "mock-n-001", name: "England", shortName: "ENG", country: "England", sport: "Football", isNational: true },
      { externalId: "mock-n-002", name: "Spain", shortName: "ESP", country: "Spain", sport: "Football", isNational: true },
      { externalId: "mock-n-003", name: "France", shortName: "FRA", country: "France", sport: "Football", isNational: true },
      { externalId: "mock-n-004", name: "Germany", shortName: "GER", country: "Germany", sport: "Football", isNational: true },
      { externalId: "mock-n-005", name: "Italy", shortName: "ITA", country: "Italy", sport: "Football", isNational: true },
      { externalId: "mock-n-006", name: "Brazil", shortName: "BRA", country: "Brazil", sport: "Football", isNational: true },
      { externalId: "mock-n-007", name: "Argentina", shortName: "ARG", country: "Argentina", sport: "Football", isNational: true },
      { externalId: "mock-n-008", name: "Portugal", shortName: "POR", country: "Portugal", sport: "Football", isNational: true },
      { externalId: "mock-n-009", name: "Netherlands", shortName: "NED", country: "Netherlands", sport: "Football", isNational: true },
      { externalId: "mock-n-010", name: "Belgium", shortName: "BEL", country: "Belgium", sport: "Football", isNational: true },
      { externalId: "mock-n-011", name: "Croatia", shortName: "CRO", country: "Croatia", sport: "Football", isNational: true },
      { externalId: "mock-n-012", name: "Morocco", shortName: "MAR", country: "Morocco", sport: "Football", isNational: true },
      { externalId: "mock-n-013", name: "Egypt", shortName: "EGY", country: "Egypt", sport: "Football", isNational: true },
      { externalId: "mock-n-014", name: "Senegal", shortName: "SEN", country: "Senegal", sport: "Football", isNational: true },
      { externalId: "mock-n-015", name: "Japan", shortName: "JPN", country: "Japan", sport: "Football", isNational: true },
      { externalId: "mock-n-016", name: "South Korea", shortName: "KOR", country: "South Korea", sport: "Football", isNational: true },
      { externalId: "mock-n-017", name: "Mexico", shortName: "MEX", country: "Mexico", sport: "Football", isNational: true },
      { externalId: "mock-n-018", name: "USA", shortName: "USA", country: "USA", sport: "Football", isNational: true },
      { externalId: "mock-n-019", name: "Colombia", shortName: "COL", country: "Colombia", sport: "Football", isNational: true },
      { externalId: "mock-n-020", name: "Uruguay", shortName: "URU", country: "Uruguay", sport: "Football", isNational: true },
      { externalId: "mock-n-021", name: "Switzerland", shortName: "SUI", country: "Switzerland", sport: "Football", isNational: true },
      { externalId: "mock-n-022", name: "Denmark", shortName: "DEN", country: "Denmark", sport: "Football", isNational: true },
      { externalId: "mock-n-023", name: "Sweden", shortName: "SWE", country: "Sweden", sport: "Football", isNational: true },
      { externalId: "mock-n-024", name: "Poland", shortName: "POL", country: "Poland", sport: "Football", isNational: true },
      { externalId: "mock-n-025", name: "Austria", shortName: "AUT", country: "Austria", sport: "Football", isNational: true },
      { externalId: "mock-n-026", name: "Serbia", shortName: "SRB", country: "Serbia", sport: "Football", isNational: true },
      { externalId: "mock-n-027", name: "Tunisia", shortName: "TUN", country: "Tunisia", sport: "Football", isNational: true },
      { externalId: "mock-n-028", name: "Cameroon", shortName: "CMR", country: "Cameroon", sport: "Football", isNational: true },
      { externalId: "mock-n-029", name: "Ghana", shortName: "GHA", country: "Ghana", sport: "Football", isNational: true },
      { externalId: "mock-n-030", name: "Ivory Coast", shortName: "CIV", country: "Ivory Coast", sport: "Football", isNational: true },
      { externalId: "mock-n-031", name: "Nigeria", shortName: "NGA", country: "Nigeria", sport: "Football", isNational: true },
      { externalId: "mock-n-032", name: "Algeria", shortName: "ALG", country: "Algeria", sport: "Football", isNational: true },
      { externalId: "mock-n-033", name: "Saudi Arabia", shortName: "KSA", country: "Saudi Arabia", sport: "Football", isNational: true },
      { externalId: "mock-n-034", name: "Iran", shortName: "IRN", country: "Iran", sport: "Football", isNational: true },
      { externalId: "mock-n-035", name: "Qatar", shortName: "QAT", country: "Qatar", sport: "Football", isNational: true },
      { externalId: "mock-n-036", name: "Australia", shortName: "AUS", country: "Australia", sport: "Football", isNational: true },
      { externalId: "mock-n-037", name: "Wales", shortName: "WAL", country: "Wales", sport: "Football", isNational: true },
      { externalId: "mock-n-038", name: "Scotland", shortName: "SCO", country: "Scotland", sport: "Football", isNational: true },
      { externalId: "mock-n-039", name: "Northern Ireland", shortName: "NIR", country: "Northern Ireland", sport: "Football", isNational: true },
      { externalId: "mock-n-040", name: "Republic of Ireland", shortName: "IRL", country: "Republic of Ireland", sport: "Football", isNational: true },
    ];
  }

  async fetchNews(): Promise<ExternalNewsArticle[]> {
    return [
      {
        externalId: "mock-news-001", title: "Premier League Weekend Preview",
        summary: "All the key matchups ahead of this weekend's action.",
        body: "The Premier League returns with a full slate of fixtures...",
        category: "Match Report", sourceName: "Mock Provider", publishedAt: new Date(),
      },
    ];
  }
}
