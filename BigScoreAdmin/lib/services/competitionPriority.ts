interface PriorityRule {
  test: (nameLower: string, countryLower?: string) => boolean;
  priority: number;
}

const PRIORITY_RULES: PriorityRule[] = [
  { test: (n) => n.includes("fifa world cup") || n === "world cup", priority: 1 },
  { test: (n) => n.includes("uefa champions league") || n === "champions league" || n === "ucl", priority: 2 },
  { test: (n) => (n.includes("european championship") || n.includes("euro championship") || (n === "euro" && !n.includes("euro qualifiers"))), priority: 3 },

  { test: (n, c) => n === "premier league" && (!c || c === "england" || c === ""), priority: 4 },
  { test: (n) => n === "la liga" || n === "laliga" || n.includes("la liga ea sports"), priority: 5 },
  { test: (n, c) => n === "serie a" && c !== "brazil" && c !== "argentina" && !n.includes("brasil") && !n.includes("brazil"), priority: 6 },
  { test: (n) => n === "bundesliga" || (n.includes("bundesliga") && !n.includes("2. bundesliga") && !n.includes("3. liga")), priority: 7 },
  { test: (n) => n === "ligue 1", priority: 8 },

  { test: (n) => n.includes("uefa europa league") || n === "europa league", priority: 9 },
  { test: (n) => n.includes("conmebol libertadores") || n.includes("copa libertadores"), priority: 10 },
  { test: (n) => n.includes("caf champions league"), priority: 11 },
  { test: (n) => n.includes("afc champions league") || n.includes("afc champions league elite"), priority: 12 },
  { test: (n) => n.includes("uefa conference league") || n.includes("europa conference league") || n === "conference league", priority: 13 },
  { test: (n) => n.includes("fifa club world cup"), priority: 14 },
  { test: (n) => n.includes("copa américa") || n.includes("copa america"), priority: 15 },
  { test: (n) => n.includes("africa cup of nations") || n === "afcon", priority: 16 },
  { test: (n) => n.includes("afc asian cup") || n === "asian cup", priority: 17 },
  { test: (n) => n.includes("caf confederation cup"), priority: 18 },
  { test: (n) => n === "afc cup", priority: 19 },

  { test: (n) => n.includes("major league soccer") || n === "mls", priority: 20 },
  { test: (n) => n === "liga mx", priority: 21 },
  { test: (n) => n.includes("saudi pro league") || n.includes("saudi professional league"), priority: 22 },
  { test: (n) => n === "eredivisie", priority: 23 },
  { test: (n) => n === "liga portugal" || n === "primeira liga", priority: 24 },
  { test: (n) => n.includes("süper lig") || n === "super lig", priority: 25 },
  { test: (n) => n.includes("2. bundesliga"), priority: 26 },
  { test: (n, c) => n.includes("brasileirão") || n.includes("brasileirao") || n.includes("serie a brazil") || (n.includes("serie a") && c === "brazil"), priority: 27 },
  { test: (n, c) => n.includes("egyptian premier league") || (n.includes("premier league") && c === "egypt"), priority: 28 },
  { test: (n, c) => n.includes("premier league kuwait") || (n.includes("premier league") && c === "kuwait"), priority: 29 },

  { test: (n) => n.includes("coppa italia"), priority: 30 },
  { test: (n) => n.includes("coupe de france"), priority: 31 },
  { test: (n) => n.includes("dfb-pokal"), priority: 32 },
  { test: (n) => n.includes("fa cup") && !n.includes("egypt") && !n.includes("arab"), priority: 33 },
  { test: (n) => n.includes("copa del rey"), priority: 34 },
  { test: (n) => n.includes("copa do brasil"), priority: 35 },

  { test: (n) => n.includes("international friendlies") || n === "friendly", priority: 50 },
  { test: (n) => n.includes("fifa world cup qualification") || n.includes("world cup qualification"), priority: 51 },
  { test: (n) => n.includes("uefa euro qualifiers") || n.includes("euro qualifiers"), priority: 52 },
];

export function getCompetitionPriority(name: string, country?: string): number {
  if (!name) return 99;
  const nameLower = name.trim().toLowerCase();
  const countryLower = country ? country.trim().toLowerCase() : undefined;

  for (const rule of PRIORITY_RULES) {
    if (rule.test(nameLower, countryLower)) {
      return rule.priority;
    }
  }

  return 99;
}

export function compareCompetitions(aName: string, bName: string, aCountry?: string, bCountry?: string): number {
  const pa = getCompetitionPriority(aName, aCountry);
  const pb = getCompetitionPriority(bName, bCountry);
  if (pa !== pb) return pa - pb;
  return aName.localeCompare(bName);
}

export interface MatchWithCompetition {
  competitionName?: string;
  status?: string;
  startDate?: { seconds: number } | Date | null;
  competition?: { country?: string };
  [key: string]: unknown;
}

export function sortMatchesByCompetitionPriority<T extends MatchWithCompetition>(matches: T[]): T[] {
  return [...matches].sort((a, b) => {
    const statusOrder: Record<string, number> = {
      live: 0, halftime: 1, scheduled: 2, finished: 3,
    };

    const statusA = a.status?.toLowerCase() || "";
    const statusB = b.status?.toLowerCase() || "";

    const orderA = statusOrder[statusA] ?? 99;
    const orderB = statusOrder[statusB] ?? 99;

    if (orderA !== orderB) return orderA - orderB;

    const compA = a.competitionName || "";
    const compB = b.competitionName || "";
    const countryA = a.competition?.country;
    const countryB = b.competition?.country;

    const compCompare = compareCompetitions(compA, compB, countryA, countryB);
    if (compCompare !== 0) return compCompare;

    let timeA = 0, timeB = 0;
    if (a.startDate) {
      if (typeof a.startDate === "object" && "seconds" in a.startDate) {
        timeA = a.startDate.seconds;
      } else if (a.startDate instanceof Date) {
        timeA = a.startDate.getTime() / 1000;
      }
    }
    if (b.startDate) {
      if (typeof b.startDate === "object" && "seconds" in b.startDate) {
        timeB = b.startDate.seconds;
      } else if (b.startDate instanceof Date) {
        timeB = b.startDate.getTime() / 1000;
      }
    }

    return timeA - timeB;
  });
}
