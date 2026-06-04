import type { ExternalMatch, ExternalCompetition, ExternalTeam } from "./base";

export interface SportsProviderInstance {
  id: string;
  providerType: string;
  priority: number;
  instance: import("./base").SportsApiProvider;
}

const COMPETITION_NORMALIZATIONS: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /ea\s*sports$/gi, replacement: "" },
  { pattern: /série\s*a/gi, replacement: "serie a" },
  { pattern: /brasileirão/gi, replacement: "brasileirao" },
  { pattern: /ligue\s*1/gi, replacement: "ligue1" },
  { pattern: /premier\s*league/gi, replacement: "premierleague" },
  { pattern: /champions\s*league/gi, replacement: "championsleague" },
  { pattern: /europa\s*league/gi, replacement: "europaleague" },
  { pattern: /conference\s*league/gi, replacement: "conferenceleague" },
];

const YEAR_PATTERNS = [
  /\s*\d{4}\/\d{2,4}\s+.*$/g,
  /\s*\d{4}\/\d{2,4}\s*$/g,
  /\s*\d{2}\/\d{2}\s+.*$/g,
  /\s*\d{2}\/\d{2}\s*$/g,
  /\s*\d{4}-\d{2,4}\s*$/g,
  /\s*\d{4}\s*$/g,
  /\s*\(\d{4}\)\s*$/g,
  /\s*-\s*\d{4}\s*$/g,
  /\s+deutsche\s+teams\s*$/gi,
];

export function stripSeasonSuffix(name: string): string {
  if (!name) return "";
  let result = name;
  let changed = true;
  while (changed) {
    changed = false;
    for (const pattern of YEAR_PATTERNS) {
      const stripped = result.replace(pattern, "").trim();
      if (stripped !== result) {
        result = stripped;
        changed = true;
      }
    }
  }
  return result.trim();
}

function normalizeCompetitionNameForSig(name: string): string {
  if (!name) return "";
  const stripped = stripSeasonSuffix(name);
  let result = stripped.toLowerCase();
  for (const norm of COMPETITION_NORMALIZATIONS) {
    result = result.replace(norm.pattern, norm.replacement);
  }
  result = result.replace(/[^a-z0-9]/g, "").trim();
  return result;
}

export function normalizeName(name: string): string {
  if (!name) return "";
  const stripped = stripSeasonSuffix(name);
  return stripped
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .replace(/\s+/g, "")
    .trim();
}

export function normalizeCompetitionKey(name: string, country: string): string {
  return `${normalizeName(name)}||${normalizeName(country || "")}`;
}

export function matchSignature(m: ExternalMatch): string {
  const home = normalizeName(m.homeTeamName || "");
  const away = normalizeName(m.awayTeamName || "");
  const comp = normalizeCompetitionNameForSig(m.competitionName || "");
  const date = m.startDate
    ? new Date(m.startDate).toISOString().slice(0, 10)
    : "";

  const keyParts = [home, away, comp, date].filter(Boolean);

  if (keyParts.length < 3) {
    return `incomplete-${m.externalId || Math.random().toString(36).slice(2)}`;
  }

  const sortedTeams = [home, away].sort().join("-vs-");
  return `${sortedTeams}||${comp}||${date}`;
}

export function matchSignatureFromFirestore(data: Record<string, unknown>): string | null {
  const homeTeam = (data.homeTeam as Record<string, unknown>) ?? {};
  const awayTeam = (data.awayTeam as Record<string, unknown>) ?? {};
  const competition = (data.competition as Record<string, unknown>) ?? {};

  const home = normalizeName(String(homeTeam.name ?? ""));
  const away = normalizeName(String(awayTeam.name ?? ""));
  const comp = normalizeCompetitionNameForSig(String(competition.name ?? ""));

  const dateRaw = data.date as { seconds: number } | undefined;
  const dateStr = dateRaw ? new Date(dateRaw.seconds * 1000).toISOString().slice(0, 10) : "";

  if (!home || !away || !comp) return null;

  const sortedTeams = [home, away].sort().join("-vs-");
  return `${sortedTeams}||${comp}||${dateStr}`;
}

export function teamSignature(t: ExternalTeam): string {
  const name = normalizeName(t.name || "");
  const country = normalizeName(t.country || "");
  const type = t.isNational ? "national" : "club";
  return `${name}||${country}||${type}`;
}

export function dedupMatches(matches: Array<ExternalMatch & { _providerId: string; _priority: number }>): (ExternalMatch & { _providerId: string; _priority: number; _mergedFrom?: string[] })[] {
  const byExtId = new Map<string, ExternalMatch & { _providerId: string; _priority: number; _mergedFrom?: string[] }>();
  const bySignature = new Map<string, ExternalMatch & { _providerId: string; _priority: number; _mergedFrom?: string[] }>();
  const result: (ExternalMatch & { _providerId: string; _priority: number; _mergedFrom?: string[] })[] = [];

  for (const m of matches) {
    const extKey = `${m._providerId}||${m.externalId}`;

    if (byExtId.has(extKey)) continue;

    const sig = matchSignature(m);
    const existingBySig = bySignature.get(sig);

    if (existingBySig) {
      if (m._priority < existingBySig._priority) {
        existingBySig._mergedFrom = existingBySig._mergedFrom || [];
        existingBySig._mergedFrom.push(`${existingBySig._providerId}:${existingBySig.externalId}`);
        const mergedFrom = existingBySig._mergedFrom;
        Object.assign(existingBySig, m);
        existingBySig._mergedFrom = mergedFrom;
      } else {
        existingBySig._mergedFrom = existingBySig._mergedFrom || [];
        existingBySig._mergedFrom.push(`${m._providerId}:${m.externalId}`);
      }
      byExtId.set(extKey, existingBySig);
    } else {
      const matchWithMeta = { ...m, _mergedFrom: [] as string[] };
      byExtId.set(extKey, matchWithMeta);
      bySignature.set(sig, matchWithMeta);
      result.push(matchWithMeta);
    }
  }

  return result;
}

export function dedupCompetitions(comps: Array<ExternalCompetition & { _providerId: string; _priority: number }>): (ExternalCompetition & { _providerId: string; _priority: number; _mergedFrom?: string[] })[] {
  const byExtId = new Map<string, ExternalCompetition & { _providerId: string; _priority: number; _mergedFrom?: string[] }>();
  const byKey = new Map<string, ExternalCompetition & { _providerId: string; _priority: number; _mergedFrom?: string[] }>();
  const result: (ExternalCompetition & { _providerId: string; _priority: number; _mergedFrom?: string[] })[] = [];

  for (const c of comps) {
    const extKey = `${c._providerId}||${c.externalId}`;

    if (byExtId.has(extKey)) continue;

    const normKey = normalizeCompetitionKey(c.name, c.country);
    const existingByKey = byKey.get(normKey);

    if (existingByKey) {
      if (c._priority < existingByKey._priority) {
        existingByKey._mergedFrom = existingByKey._mergedFrom || [];
        existingByKey._mergedFrom.push(`${existingByKey._providerId}:${existingByKey.externalId}`);
        const mergedFrom = existingByKey._mergedFrom;
        Object.assign(existingByKey, c);
        existingByKey._mergedFrom = mergedFrom;
      } else {
        existingByKey._mergedFrom = existingByKey._mergedFrom || [];
        existingByKey._mergedFrom.push(`${c._providerId}:${c.externalId}`);
      }
      byExtId.set(extKey, existingByKey);
    } else {
      const compWithMeta = { ...c, _mergedFrom: [] as string[] };
      byExtId.set(extKey, compWithMeta);
      byKey.set(normKey, compWithMeta);
      result.push(compWithMeta);
    }
  }

  return result;
}

export function dedupTeams(teams: Array<ExternalTeam & { _providerId: string; _priority: number }>): (ExternalTeam & { _providerId: string; _priority: number; _mergedFrom?: string[] })[] {
  const byExtId = new Map<string, ExternalTeam & { _providerId: string; _priority: number; _mergedFrom?: string[] }>();
  const bySig = new Map<string, ExternalTeam & { _providerId: string; _priority: number; _mergedFrom?: string[] }>();
  const result: (ExternalTeam & { _providerId: string; _priority: number; _mergedFrom?: string[] })[] = [];

  for (const t of teams) {
    const extKey = `${t._providerId}||${t.externalId}`;

    if (byExtId.has(extKey)) continue;

    const sig = teamSignature(t);
    const existingBySig = bySig.get(sig);

    if (existingBySig) {
      if (t._priority < existingBySig._priority) {
        existingBySig._mergedFrom = existingBySig._mergedFrom || [];
        existingBySig._mergedFrom.push(`${existingBySig._providerId}:${existingBySig.externalId}`);
        const mergedFrom = existingBySig._mergedFrom;
        Object.assign(existingBySig, t);
        existingBySig._mergedFrom = mergedFrom;
      } else {
        existingBySig._mergedFrom = existingBySig._mergedFrom || [];
        existingBySig._mergedFrom.push(`${t._providerId}:${t.externalId}`);
      }
      byExtId.set(extKey, existingBySig);
    } else {
      const teamWithMeta = { ...t, _mergedFrom: [] as string[] };
      byExtId.set(extKey, teamWithMeta);
      bySig.set(sig, teamWithMeta);
      result.push(teamWithMeta);
    }
  }

  return result;
}
