import { adminDb } from "@/lib/firebase/admin";
import { createAuditLog } from "@/lib/audit/createAuditLog";
import { FieldValue, DocumentReference } from "firebase-admin/firestore";
import { createProvider, NoopFutureFixturesProvider } from "./providers/index";
import type { SportsApiProvider, SportsApiProviderConfig, ExternalMatch, ExternalCompetition, ExternalTeam } from "./providers/base";
import type { FutureFixturesProvider } from "./providers/futureFixturesProvider";
import { adminStorage } from "@/lib/firebase/admin";
import { 
  matchSignature, 
  matchSignatureFromFirestore, 
  dedupMatches,
  dedupCompetitions,
  dedupTeams,
  normalizeName,
  normalizeCompetitionKey,
  stripSeasonSuffix,
} from "./providers/aggregator";

interface ProviderInstance {
  id: string;
  providerType: string;
  priority: number;
  instance: SportsApiProvider;
}

async function checkRateLimit(providerId: string, dailyLimit: number): Promise<boolean> {
  if (dailyLimit >= 9999) return true;

  const docRef = adminDb.collection("appSettings").doc("rateLimits");
  const snap = await docRef.get();
  const now = Date.now();

  if (!snap.exists) {
    await docRef.set({ [providerId]: { count: 1, resetAt: now + 86_400_000 } }, { merge: true });
    return true;
  }

  const data = snap.data() as Record<string, { count: number; resetAt: number }> | undefined;
  const tracker = data?.[providerId];

  if (!tracker || now > tracker.resetAt) {
    await docRef.set({ [providerId]: { count: 1, resetAt: now + 86_400_000 } }, { merge: true });
    return true;
  }

  if (tracker.count >= dailyLimit) {
    const resetHrs = Math.ceil((tracker.resetAt - now) / 3600000);
    console.log(`[rateLimit] ${providerId} exhausted (${tracker.count}/${dailyLimit}), resets in ~${resetHrs}h`);
    return false;
  }

  await docRef.set({ [providerId]: { count: tracker.count + 1, resetAt: tracker.resetAt } }, { merge: true });
  return true;
}

async function loadSettings(): Promise<Record<string, unknown> | null> {
  const snap = await adminDb.collection("appSettings").doc("liveMatches").get();
  if (!snap.exists) return null;
  return snap.data() as Record<string, unknown>;
}

const ALLOWED_COMPETITIONS = new Set([
  "FIFA World Cup||World", "UEFA Champions League||World", "UEFA Europa League||World",
  "UEFA Conference League||World", "UEFA Europa Conference League||World",
  "European Championship||World", "Euro Championship||World",
  "Copa América||World", "Copa America||World",
  "Africa Cup of Nations||World", "AFCON||Africa",
  "AFC Asian Cup||World", "Asian Cup||World",
  "CONMEBOL Libertadores||World", "Copa Libertadores||World",
  "FIFA Club World Cup||World",
  "Arab Cup||World", "FIFA Arab Cup||World",
  "UEFA Euro Qualifiers||World", "World Cup Qualification||World",
  "FIFA World Cup Qualification||World",
  "Premier League||England", "La Liga||Spain",
  "Bundesliga||Germany", "1. Bundesliga||Germany", "2. Bundesliga||Germany",
  "3. Liga||Germany", "DFB-Pokal||Germany",
  "Serie A||Italy", "Coppa Italia||Italy",
  "Ligue 1||France", "Coupe de France||France",
  "Eredivisie||Netherlands",
  "Primeira Liga||Portugal", "Liga Portugal||Portugal",
  "Süper Lig||Turkey", "Super Lig||Turkey",
  "Serie A||Brazil", "Brasileirão Série A||Brazil", "Brasileirao Serie A||Brazil",
  "Serie B||Brazil", "Serie C||Brazil", "Serie D||Brazil",
  "Copa do Brasil||Brazil",
  "Primera División||Argentina", "Liga Profesional Argentina||Argentina",
  "Primera Nacional||Argentina", "Primera B Metropolitana||Argentina",
  "Major League Soccer||USA", "MLS||USA",
  "USL Championship||USA",
  "NWSL Women||USA",
  "Liga MX||Mexico",
  "Pro League||Saudi-Arabia", "Saudi Pro League||Saudi-Arabia",
  "Saudi Professional League||Saudi-Arabia",
  "King Cup||Saudi-Arabia",
  "Pro League||United-Arab-Emirates", "UAE Pro League||United-Arab-Emirates",
  "Stars League||Qatar", "Qatar Stars League||Qatar",
  "CAF Champions League||World",
  "CAF Confederation Cup||World",
  "Premier League||Egypt", "Egyptian Premier League||Egypt",
  "Egypt Cup||Egypt",
  "Premier Soccer League||South-Africa", "South African Premier League||South-Africa",
  "Ligue 1||Ivory-Coast", "Ivorian Premier Division||Ivory-Coast",
  "Ligue 1||Algeria", "Ligue Professionnelle 1||Algeria",
  "Botola Pro||Morocco", "Botola||Morocco",
  "AFC Champions League||World", "AFC Champions League Elite||World",
  "AFC Cup||World",
  "Premier League||Kuwait", "Pro League||Kuwait",
  "Friendly||World", "International Friendlies||World",
  // Summer leagues (active June-Sep)
  "Allsvenskan||Sweden", "Superettan||Sweden",
  "Eliteserien||Norway", "1. Division||Norway", "OBOS-ligaen||Norway",
  "Veikkausliiga||Finland",
  "J1 League||Japan", "J2 League||Japan",
  "K League 1||South-Korea", "K League 2||South-Korea",
  "Super League||China", "League One||China",
  "A-League Men||Australia", "A-League Women||Australia",
  "Indian Super League||India",
  "Liga 1||Romania",
  "Ekstraklasa||Poland",
  "Czech Liga||Czech-Republic",
  "Super Liga||Slovakia",
  "HNL||Croatia",
  "PrvaLiga||Slovenia",
  "NB I||Hungary",
  "Premijer Liga||Bosnia",
  "Prva Crnogorska Liga||Montenegro",
  "1. SNL||Slovenia",
  "Liga I||Romania",
  "Liga II||Romania",
  "Primera División||Chile", "Primera B||Chile",
  "Primera División||Peru",
  "Primera División||Venezuela",
  "Liga Pro||Ecuador",
  "Primera División||Bolivia",
  "Primera División||Uruguay",
  "Primera División||Paraguay",
  "Canadian Premier League||Canada",
  "Liga de Expansión MX||Mexico",
]);

const DOMESTIC_LEAGUES = new Set([
  "Premier League||England", "La Liga||Spain", "Bundesliga||Germany",
  "Serie A||Italy", "Ligue 1||France", "Eredivisie||Netherlands",
  "Primeira Liga||Portugal", "Liga Portugal||Portugal",
  "Süper Lig||Turkey", "Super Lig||Turkey",
  "Serie A||Brazil", "Brasileirão Série A||Brazil", "Brasileirao Serie A||Brazil",
  "Serie B||Brazil",
  "Primera División||Argentina", "Liga Profesional Argentina||Argentina",
  "Major League Soccer||USA", "MLS||USA",
  "Liga MX||Mexico",
  "Pro League||Saudi-Arabia",
  "Pro League||United-Arab-Emirates",
  "Stars League||Qatar",
  "Premier League||Egypt",
  "Premier Soccer League||South-Africa",
  "Ligue 1||Ivory-Coast",
  "Ligue 1||Algeria",
  "Botola Pro||Morocco", "Botola||Morocco",
  "Premier League||Kuwait",
  "1. Bundesliga||Germany", "2. Bundesliga||Germany", "3. Liga||Germany",
  "Allsvenskan||Sweden",
  "Eliteserien||Norway",
  "J1 League||Japan",
  "K League 1||South-Korea",
  "Super League||China",
  "Ekstraklasa||Poland",
  "Czech Liga||Czech-Republic",
  "HNL||Croatia",
  "Liga 1||Romania",
  "Primera División||Chile",
  "Primera División||Peru",
  "Primera División||Venezuela",
  "Liga Pro||Ecuador",
  "Canadian Premier League||Canada",
  "Indian Super League||India",
]);

function isAllowedCompetition(name: string, country: string): boolean {
  const key = `${name}||${country}`;
  if (ALLOWED_COMPETITIONS.has(key)) return true;
  if (ALLOWED_COMPETITIONS.has(`${name}||World`)) return true;

  const nameLower = name.toLowerCase();

  if (nameLower.includes("world cup") && nameLower.includes("qualif")) return true;
  if (nameLower.includes("fifa world cup")) return true;
  if (nameLower === "world cup") return true;

  if (nameLower.includes("euro") && nameLower.includes("qualif")) return true;
  if (nameLower.includes("european championship")) return true;
  if (nameLower === "euro" || nameLower === "uefa euro") return true;

  if (nameLower.includes("copa america")) return true;
  if (nameLower.includes("african cup") || nameLower.includes("afcon")) return true;
  if (nameLower.includes("asian cup")) return true;
  if (nameLower.includes("copa libertadores")) return true;
  if (nameLower.includes("arab cup")) return true;

  if (nameLower.includes("champions league")) return true;
  if (nameLower.includes("europa league") || nameLower.includes("europa conference")) return true;
  if (nameLower.includes("uefa conference")) return true;

  if (nameLower === "friendly" || nameLower === "friendlies" || nameLower === "international friendlies") return true;
  if (nameLower.includes("friendly")) return true;

  if (nameLower.includes("nations league")) return true;
  if (nameLower.includes("gold cup")) return true;
  if (nameLower.includes("caf champions") || nameLower.includes("caf confederation")) return true;
  if (nameLower.includes("afc champions") || nameLower.includes("afc cup")) return true;
   if (nameLower.includes("club world cup")) return true;

   // OpenLigaDB German names: "WM 2026" = World Cup 2026, "Freundschafts..." = friendly matches
   if (/^wm\s+\d{4}/.test(nameLower)) return true;
   if (nameLower.includes("freundschaft")) return true;

   // summer league catch-all: flag known summer-season countries
   const summerCountries = ["sweden", "norway", "finland", "japan", "south-korea", "china",
     "australia", "india", "poland", "czech", "slovakia", "hungary", "romania",
     "croatia", "slovenia", "bosnia", "montenegro",
     "chile", "peru", "venezuela", "ecuador", "bolivia", "uruguay", "paraguay",
     "canada", "usa", "united-states"];
   const countryLower = country.toLowerCase().replace(/\s+/g, "-");
   if (summerCountries.includes(countryLower)) return true;

   return false;
 }

 function inferCompetitionTeamType(name: string): "club" | "national" {
   const nameLower = name.toLowerCase();

   if (nameLower.includes("world cup") && !nameLower.includes("club world cup")) return "national";
   if (nameLower.includes("fifa world cup")) return "national";
   if (nameLower.includes("euro")) {
     if (nameLower.includes("league") || nameLower.includes("europa")) return "club";
     return "national";
   }
   if (nameLower.includes("european championship")) return "national";
   if (nameLower.includes("copa america")) return "national";
   if (nameLower.includes("african cup") || nameLower.includes("afcon")) return "national";
   if (nameLower.includes("asian cup")) return "national";
   if (nameLower.includes("arab cup")) return "national";
   if (nameLower.includes("nations league")) return "national";
   if (nameLower.includes("gold cup")) return "national";
    if (nameLower.includes("friendly")) return "national";
    if (nameLower.includes("international")) return "national";
    if (nameLower.includes("world cup qualification") || nameLower.includes("world cup qualif")) return "national";
    if (nameLower.includes("euro qualification") || nameLower.includes("euro qualif")) return "national";
    if (/^wm\s+\d{4}/.test(nameLower)) return "national";
    if (nameLower.includes("freundschaft")) return "national";

   if (nameLower.includes("club world cup")) return "club";
   if (nameLower.includes("champions league")) return "club";
   if (nameLower.includes("europa league")) return "club";
   if (nameLower.includes("europa conference")) return "club";
   if (nameLower.includes("uefa conference")) return "club";
   if (nameLower.includes("copa libertadores")) return "club";
   if (nameLower.includes("caf champions")) return "club";
   if (nameLower.includes("caf confederation")) return "club";
   if (nameLower.includes("afc champions")) return "club";
   if (nameLower.includes("afc cup")) return "club";
   if (nameLower.includes("premier league")) return "club";
   if (nameLower.includes("la liga")) return "club";
   if (nameLower.includes("bundesliga")) return "club";
   if (nameLower.includes("serie a")) return "club";
   if (nameLower.includes("ligue 1")) return "club";
   if (nameLower.includes("eredivisie")) return "club";
   if (nameLower.includes("primeira liga")) return "club";
   if (nameLower.includes("liga portugal")) return "club";
   if (nameLower.includes("süper lig")) return "club";
   if (nameLower.includes("super lig")) return "club";
   if (nameLower.includes("brasileirão")) return "club";
   if (nameLower.includes("brasileirao")) return "club";
   if (nameLower.includes("serie a") && nameLower.includes("brazil")) return "club";
   if (nameLower.includes("primera división")) return "club";
   if (nameLower.includes("liga profesional")) return "club";
   if (nameLower.includes("major league soccer")) return "club";
   if (nameLower.includes("mls")) return "club";
   if (nameLower.includes("liga mx")) return "club";
   if (nameLower.includes("pro league") && nameLower.includes("saudi")) return "club";
   if (nameLower.includes("saudi pro league")) return "club";
   if (nameLower.includes("stars league")) return "club";
   if (nameLower.includes("qatar stars")) return "club";
   if (nameLower.includes("premier league") && nameLower.includes("egypt")) return "club";
   if (nameLower.includes("egyptian premier")) return "club";
   if (nameLower.includes("premier soccer league")) return "club";
   if (nameLower.includes("south african premier")) return "club";
   if (nameLower.includes("botola")) return "club";
   if (nameLower.includes("dfb-pokal")) return "club";
   if (nameLower.includes("coppa italia")) return "club";
   if (nameLower.includes("coupe de france")) return "club";
   if (nameLower.includes("copa do brasil")) return "club";
   if (nameLower.includes("king cup")) return "club";
   if (nameLower.includes("egypt cup")) return "club";

   return "club";
 }

/**
 * Maps a provider ID to a human-readable reason when it returns zero scheduled matches.
 */
function determineZeroScheduledReason(providerId: string): { reason: string; detail: string } {
  switch (providerId) {
    case "api-football":
      return {
        reason: "free_tier_restricted",
        detail: "API-Football free tier only returns fixtures within ±1 day of today. Upgrade to a paid plan for full date-range access.",
      };
    case "football-data":
      return {
        reason: "season_ended",
        detail: "Football-Data.org free tier has limited competition coverage. Most European seasons ended May 24, 2026; new season schedules are not yet published.",
      };
    case "openligadb":
      return {
        reason: "limited_coverage",
        detail: "OpenLigaDB queried its available leagues (German leagues + select tournaments) and found no matches in the requested date range. The 2026 FIFA World Cup starts June 11.",
      };
    case "mock":
      return {
        reason: "dev_only",
        detail: "Mock provider is for development use only and does not return real scheduled matches.",
      };
    default:
      return {
        reason: "no_data",
        detail: `Provider "${providerId}" returned zero scheduled matches for the requested date range.`,
      };
  }
}

/**
 * Summarises per-provider scheduled-match availability for the admin panel.
 * Determines whether any provider returned data and generates a plain-English
 * explanation of the current coverage situation.
 */
function buildAvailabilitySummary(
  availability: Record<string, { returned: number; reason: string | null }>
): { overallAvailable: boolean; summary: string } {
  const entries = Object.entries(availability);
  if (entries.length === 0) {
    return {
      overallAvailable: false,
      summary: "No providers were queried for scheduled matches.",
    };
  }

  const withData = entries.filter(([, v]) => v.returned > 0);
  const withoutData = entries.filter(([, v]) => v.returned === 0);
  const overallAvailable = withData.length > 0;

  const parts: string[] = [];
  if (withData.length > 0) {
    const lines = withData.map(([id, v]) => `${id}: ${v.returned} matches`);
    parts.push(`Providers with data (${withData.length}): ${lines.join(", ")}.`);
  }
  if (withoutData.length > 0) {
    parts.push(`Providers with no data (${withoutData.length}):`);
    for (const [id, v] of withoutData) {
      const reason = v.reason ?? "unknown";
      parts.push(`  ${id} → ${reason.replace(/_/g, " ")}`);
    }
  }

  return {
    overallAvailable,
    summary: parts.join("\n"),
  };
}

  let _storageBucketChecked = false;
 let _storageBucketAvailable = true;

 async function storeLogoPermanently(
  sourceUrl: string | null | undefined,
  path: string
): Promise<string | null> {
  if (!sourceUrl || !sourceUrl.startsWith("http")) return sourceUrl ?? null;

  if (!_storageBucketChecked) {
    try {
      const bucket = adminStorage.bucket();
      await bucket.getMetadata();
      _storageBucketAvailable = true;
    } catch {
      _storageBucketAvailable = false;
      console.log("[storeLogo] Firebase Storage bucket not configured, using original URLs");
    }
    _storageBucketChecked = true;
  }

  if (!_storageBucketAvailable) {
    return sourceUrl;
  }

  try {
    const res = await fetch(sourceUrl, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return sourceUrl;
    const buffer = Buffer.from(await res.arrayBuffer());
    const bucket = adminStorage.bucket();
    const file = bucket.file(path);
    await file.save(buffer, { contentType: res.headers.get("content-type") ?? "image/png" });
    await file.makePublic();
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${path}`;
    console.log(`[storeLogo] Saved: ${sourceUrl} → ${publicUrl}`);
    return publicUrl;
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.log(`[storeLogo] Using original URL (storage failed: ${errMsg.substring(0, 60)}...)`);
    return sourceUrl;
  }
}

const BUILTIN_PROVIDER_CONFIGS: Array<{
  providerType: string;
  priority: number;
  defaultBaseUrl?: string;
  envKeyNames: string[];
}> = [
  { providerType: "api-football", priority: 0, defaultBaseUrl: "https://v3.football.api-sports.io", envKeyNames: ["API_FOOTBALL_KEY", "LIVE_SCORE_API_KEY"] },
  { providerType: "football-data", priority: 1, defaultBaseUrl: "https://api.football-data.org", envKeyNames: ["FOOTBALL_DATA_KEY"] },
  { providerType: "openligadb", priority: 2, defaultBaseUrl: "https://api.openligadb.de", envKeyNames: [] },
  { providerType: "mock", priority: 100, defaultBaseUrl: "", envKeyNames: [] },
];

export class SportsAPIManager {
  private static instance: SportsAPIManager | null = null;
  static getInstance(): SportsAPIManager {
    if (!SportsAPIManager.instance) SportsAPIManager.instance = new SportsAPIManager();
    return SportsAPIManager.instance;
  }

  async resolveAllProviders(): Promise<{ providers: ProviderInstance[]; settings: Record<string, unknown> }> {
    const settings = await loadSettings();
    if (!settings) {
      console.warn("[resolveAllProviders] No settings found, using defaults (openligadb + mock)");
      const providers: ProviderInstance[] = [];

      try {
        const olb = createProvider("openligadb", { providerId: "openligadb", apiKey: "", baseUrl: "https://api.openligadb.de" });
        providers.push({ id: "openligadb-primary", providerType: "openligadb", priority: 2, instance: olb });
      } catch (e) {
        console.warn("[resolveAllProviders] Failed to init OpenLigaDB:", e);
      }

      try {
        const mock = createProvider("mock", { providerId: "mock", apiKey: "mock-key", baseUrl: "" });
        providers.push({ id: "mock-fallback", providerType: "mock", priority: 100, instance: mock });
      } catch (e) {
        console.warn("[resolveAllProviders] Failed to init Mock:", e);
      }

      return { providers, settings: {} };
    }

    const primaryProviderName = (settings.apiProviderName as string) || "auto";
    const keyEnvName = (settings.apiKeySecretName as string) || "";
    const baseUrl = (settings.apiBaseUrl as string) || "";
    const providers: ProviderInstance[] = [];

    if (primaryProviderName && primaryProviderName !== "auto") {
      const apiKey = process.env[keyEnvName] || process.env.LIVE_SCORE_API_KEY || process.env.API_FOOTBALL_KEY || "mock-key";
      try {
        const primary = createProvider(primaryProviderName, {
          providerId: primaryProviderName,
          apiKey,
          baseUrl: baseUrl || (primaryProviderName === "openligadb" ? "https://api.openligadb.de" : ""),
        } as SportsApiProviderConfig);

        providers.push({
          id: `primary-${primaryProviderName}`,
          providerType: primaryProviderName,
          priority: 0,
          instance: primary,
        });

        console.log(`[resolveAllProviders] Primary provider: ${primaryProviderName} (priority 0)`);
      } catch (e) {
        console.warn(`[resolveAllProviders] Failed to init primary ${primaryProviderName}:`, e);
      }
    }

    const alreadyAdded = new Set(providers.map((p) => p.providerType));

    for (const builtin of BUILTIN_PROVIDER_CONFIGS) {
      if (alreadyAdded.has(builtin.providerType)) continue;

      if (builtin.providerType === "mock" && providers.length > 0) {
        console.log("[resolveAllProviders] Skipping mock — real providers available");
        continue;
      }

      let apiKey = "";
      for (const envName of builtin.envKeyNames) {
        if (process.env[envName]) {
          apiKey = process.env[envName]!;
          break;
        }
      }

      if (builtin.envKeyNames.length > 0 && !apiKey) {
        console.log(`[resolveAllProviders] Skipping ${builtin.providerType} - no API key in env`);
        continue;
      }

      try {
        const provider = createProvider(builtin.providerType, {
          providerId: builtin.providerType,
          apiKey,
          baseUrl: builtin.defaultBaseUrl || "",
        } as SportsApiProviderConfig);

        providers.push({
          id: `auto-${builtin.providerType}`,
          providerType: builtin.providerType,
          priority: builtin.priority,
          instance: provider,
        });

        console.log(`[resolveAllProviders] Auto-added ${builtin.providerType} (priority ${builtin.priority})`);
        alreadyAdded.add(builtin.providerType);
      } catch (e) {
        console.warn(`[resolveAllProviders] Failed to init ${builtin.providerType}:`, e);
      }
    }

    providers.sort((a, b) => a.priority - b.priority);

    if (providers.length === 0) {
      console.warn("[resolveAllProviders] No providers available, adding mock as fallback");
      const mock = createProvider("mock", { providerId: "mock", apiKey: "mock-key", baseUrl: "" });
      providers.push({ id: "mock-last-resort", providerType: "mock", priority: 999, instance: mock });
    }

    console.log(`[resolveAllProviders] Total providers loaded: ${providers.length}`);
    providers.forEach((p) => console.log(`  - ${p.id} (type=${p.providerType}, priority=${p.priority})`));

    return { providers, settings };
  }

  async resolveProvider() {
    const { providers, settings } = await this.resolveAllProviders();
    const primary = providers[0];
    if (!primary) throw new Error("No providers available");
    return { provider: primary.instance, settings, config: { providerId: primary.id } };
  }

   async syncLiveMatches(mode: string = "full"): Promise<{ created: number; updated: number; providersQueried: number; totalDeduped: number }> {
     const { providers, settings } = await this.resolveAllProviders();
     if (providers.length === 0) throw new Error("No sports API providers available.");

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const scheduledRangeEnd = new Date(today);
      scheduledRangeEnd.setDate(scheduledRangeEnd.getDate() + 6);
     const allMatchesWithMeta: Array<ExternalMatch & { _providerId: string; _priority: number }> = [];

      // Phase 1: fetch live results from ALL providers (needs real-time data from all)
      for (const p of providers) {
        if (!(await checkRateLimit(p.instance.id, p.instance.dailyRateLimit))) {
          console.log(`[syncLiveMatches] Skipping ${p.id} for live - rate limit reached`);
          continue;
        }

        console.log(`[syncLiveMatches] Querying live from ${p.id} (priority ${p.priority})...`);

        try {
          const live = await p.instance.fetchLiveResults();
          console.log(`[syncLiveMatches] ${p.id}: ${live.length} live matches`);

          for (const m of live) {
            allMatchesWithMeta.push({ ...m, _providerId: p.id, _priority: p.priority });
          }
        } catch (e) {
          console.error(`[syncLiveMatches] Failed to query live from ${p.id}:`, e);
        }
      }

      // Phase 2: scheduled matches (only in "full" mode — not in "live" mode)
      const scheduledAvailability: Record<string, {
        returned: number;
        reason: string | null;
        detail: string;
        lastCheckedAt: string;
      }> = {};

      if (mode === "full") {
        for (const p of providers) {
          const providerId = p.instance.id;

          if (!(await checkRateLimit(p.instance.id, p.instance.dailyRateLimit))) {
            scheduledAvailability[providerId] = {
              returned: 0,
              reason: "rate_limited",
              detail: "Daily rate limit exhausted during this sync cycle.",
              lastCheckedAt: new Date().toISOString(),
            };
            console.log(`[scheduled] ${p.id} rate limited, skipping scheduled query`);
            continue;
          }

          try {
            const scheduled = await p.instance.fetchScheduledMatches(today, scheduledRangeEnd);
            console.log(`[scheduled] ${p.id}: ${scheduled.length} scheduled matches`);

            for (const m of scheduled) {
              allMatchesWithMeta.push({ ...m, _providerId: p.id, _priority: p.priority });
            }

            if (scheduled.length === 0) {
              const reason = determineZeroScheduledReason(providerId);
              scheduledAvailability[providerId] = {
                returned: 0,
                reason: reason.reason,
                detail: reason.detail,
                lastCheckedAt: new Date().toISOString(),
              };
            } else {
              scheduledAvailability[providerId] = {
                returned: scheduled.length,
                reason: null,
                detail: `Returned ${scheduled.length} scheduled matches in date range.`,
                lastCheckedAt: new Date().toISOString(),
              };
            }
          } catch (e) {
            console.warn(`[scheduled] ${p.id} failed:`, e);
            scheduledAvailability[providerId] = {
              returned: 0,
              reason: "error",
              detail: e instanceof Error ? e.message.substring(0, 120) : "Unknown fetch error",
              lastCheckedAt: new Date().toISOString(),
            };
          }
        }

        // Phase 2.5: query the future-fixtures placeholder
        const ffProvider: FutureFixturesProvider = new NoopFutureFixturesProvider();
        try {
          const ffMatches = await ffProvider.fetchScheduledMatches(today, scheduledRangeEnd);
          for (const m of ffMatches) {
            allMatchesWithMeta.push({ ...m, _providerId: ffProvider.id, _priority: 10 });
          }
          const ffAvail = await ffProvider.getAvailability();
          scheduledAvailability[ffProvider.id] = {
            returned: ffMatches.length,
            reason: ffAvail.reason,
            detail: ffAvail.detail,
            lastCheckedAt: new Date().toISOString(),
          };
        } catch (e) {
          console.warn(`[scheduled] future-fixtures placeholder failed:`, e);
          scheduledAvailability[ffProvider.id] = {
            returned: 0,
            reason: "error",
            detail: e instanceof Error ? e.message.substring(0, 120) : "Placeholder error",
            lastCheckedAt: new Date().toISOString(),
          };
        }
      } else {
        console.log(`[syncLiveMatches] Skipping Phase 2 scheduled sync (mode=${mode})`);
      }

     console.log(`[syncLiveMatches] Total before dedup: ${allMatchesWithMeta.length} matches from ${providers.length} providers`);

    const deduped = dedupMatches(allMatchesWithMeta);
    console.log(`[syncLiveMatches] After dedup: ${deduped.length} unique matches`);

    const filtered = deduped.filter((m) => {
      const allowed = isAllowedCompetition(m.competitionName, m.country ?? "");
      if (!allowed) {
        console.log(`[syncLiveMatches] Filtered out: "${m.competitionName}" (${m.country})`);
      }
      return allowed;
    });

    console.log(`[syncLiveMatches] After competition filter: ${filtered.length} matches`);

    const existingSnap = await adminDb.collection("matches").where("sourceType", "in", ["api", "hybrid"]).get();
    const existingByExternalId = new Map<string, { docId: string; originalProvider: string }>();
    const existingBySignature = new Map<string, { docId: string; originalProvider: string }>();
    const existingDocs = new Map<string, Record<string, unknown>>();

    existingSnap.forEach((doc) => {
      const d = doc.data();
      existingDocs.set(doc.id, d);
      const extId = (d.externalApiMatchId as string) || ((d.source as Record<string, unknown>)?.externalId as string);
      const provider = (d.source as Record<string, unknown>)?.provider as string || "unknown";

      if (extId) {
        existingByExternalId.set(extId, { docId: doc.id, originalProvider: provider });
      }

      const sig = matchSignatureFromFirestore(d);
      if (sig) {
        existingBySignature.set(sig, { docId: doc.id, originalProvider: provider });
      }
    });

    const statusMap: Record<string, string> = {
      "1H": "live", "2H": "live", HT: "halftime", FT: "finished",
      NS: "scheduled", PST: "postponed", CANC: "cancelled",
      LIVE: "live", SCHEDULED: "scheduled", FINISHED: "finished",
      IN_PLAY: "live", PAUSED: "halftime",
      live: "live", scheduled: "scheduled", finished: "finished", halftime: "halftime",
    };

    let created = 0, updated = 0;
    const activeExternalIds = new Set<string>();
    const activeDocIds = new Set<string>();

    for (const m of filtered) {
      const matchStatus = statusMap[m.status] || statusMap[m.status?.toUpperCase() || ""] || "scheduled";
      const timeStr = m.startDate ? new Date(m.startDate).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false }) : "00:00";

      const homeTeam = { id: m.homeTeamId ?? m.homeTeamName?.toLowerCase().replace(/\s+/g, "-") ?? "", name: m.homeTeamName ?? "", shortName: m.homeTeamName?.substring(0, 3).toUpperCase() ?? "", logo: m.homeTeamLogoUrl ?? "" };
      const awayTeam = { id: m.awayTeamId ?? m.awayTeamName?.toLowerCase().replace(/\s+/g, "-") ?? "", name: m.awayTeamName ?? "", shortName: m.awayTeamName?.substring(0, 3).toUpperCase() ?? "", logo: m.awayTeamLogoUrl ?? "" };
      const competition = { id: m.competitionId ?? m.competitionName?.toLowerCase().replace(/\s+/g, "-") ?? "", name: m.competitionName ?? "", country: m.country ?? "", countryCode: "", logo: m.competitionLogoUrl ?? m.logoUrl ?? "", flagUrl: null, isFavorite: false, liveMatchCount: 0, todayMatchCount: 0 };

      const sig = matchSignature(m);

      let existingDocId: string | undefined;
      const byExtId = existingByExternalId.get(m.externalId);
      const bySig = existingBySignature.get(sig);

      if (byExtId) {
        existingDocId = byExtId.docId;
      } else if (bySig) {
        existingDocId = bySig.docId;
        console.log(`[syncLiveMatches] Matched by signature: ${m.homeTeamName} vs ${m.awayTeamName} -> doc ${existingDocId}`);
      }

      activeExternalIds.add(m.externalId);

      const providerInfo = m._mergedFrom && m._mergedFrom.length > 0
        ? `Aggregated from ${m._providerId} + ${m._mergedFrom.length} other(s)`
        : `From ${m._providerId}`;

      const matchData = {
        homeTeam, awayTeam, competition, date: m.startDate, time: timeStr, status: matchStatus,
        score: (m.homeScore != null || m.awayScore != null) ? { home: m.homeScore ?? 0, away: m.awayScore ?? 0 } : null,
        minute: m.currentMinute ?? null, stadium: m.stadium ?? null, venueDisplayText: m.stadium ?? null,
        streamUrl: null, streamProvider: null, streamQuality: null, enableWatchMode: false,
        isPublished: (settings.autoPublishApiMatches as boolean) ?? true, sourceType: "api", displayOrder: 999, streams: [],
        source: {
          type: "api" as const,
          provider: m._providerId,
          originalProviders: [m._providerId, ...(m._mergedFrom || [])],
          externalId: m.externalId,
          lastSyncedAt: FieldValue.serverTimestamp(),
          lastManualEditAt: null,
          providerInfo,
        },
        manualOverrides: { enabled: false, fields: [] }, updatedAt: FieldValue.serverTimestamp(),
      };

      if (existingDocId) {
        const existingDoc = existingDocs.get(existingDocId);
        if (existingDoc && (existingDoc.manualOverrides as Record<string, unknown>)?.enabled) {
          if (existingDoc.streamUrl) (matchData as Record<string, unknown>).streamUrl = existingDoc.streamUrl;
          if ((existingDoc.streams as unknown[])?.length) (matchData as Record<string, unknown>).streams = existingDoc.streams;
          if (existingDoc.enableWatchMode) (matchData as Record<string, unknown>).enableWatchMode = existingDoc.enableWatchMode;
          (matchData as Record<string, unknown>).manualOverrides = existingDoc.manualOverrides;
        }
        activeDocIds.add(existingDocId);
        await adminDb.collection("matches").doc(existingDocId).update(matchData);
        updated++;
      } else {
        await adminDb.collection("matches").add({ ...matchData, isActive: true, createdAt: FieldValue.serverTimestamp() });
        created++;
      }
    }

    for (const [extId, { docId, originalProvider }] of existingByExternalId) {
      if (!activeExternalIds.has(extId)) {
        console.log(`[syncLiveMatches] Marking as finished: ${docId} (from ${originalProvider})`);
        await adminDb.collection("matches").doc(docId).update({
          status: "finished",
          updatedAt: FieldValue.serverTimestamp(),
        });
        updated++;
      }
    }

    for (const [sig, { docId, originalProvider }] of existingBySignature) {
      if (!activeDocIds.has(docId)) {
        console.log(`[syncLiveMatches] Marking signature-matched as finished: ${docId} (from ${originalProvider})`);
        await adminDb.collection("matches").doc(docId).update({
          status: "finished",
          updatedAt: FieldValue.serverTimestamp(),
        });
        updated++;
      }
    }

    const providerNames = providers.map((p) => p.id).join(", ");

    const liveMatchesUpdate: Record<string, unknown> = {
      lastSyncAt: FieldValue.serverTimestamp(),
      lastSyncStatus: "success",
      lastSyncError: null,
      lastSyncProviders: providerNames,
      lastSyncStats: {
        totalQueried: allMatchesWithMeta.length,
        afterDedup: deduped.length,
        afterFilter: filtered.length,
        created,
        updated,
      },
    };

    if (mode === "full") {
      const availabilitySummary = buildAvailabilitySummary(scheduledAvailability);
      liveMatchesUpdate.scheduledMatchAvailability = {
        providers: scheduledAvailability,
        overallAvailable: availabilitySummary.overallAvailable,
        summary: availabilitySummary.summary,
        lastUpdatedAt: FieldValue.serverTimestamp(),
      };
    }

    await adminDb.collection("appSettings").doc("liveMatches").update(liveMatchesUpdate);

    await createAuditLog({
      actorUid: "api-sync", actorEmail: "system@bigscore.com", action: "create", resourceType: "sync",
      description: `Multi-provider live sync: ${created} created, ${updated} updated. Providers: ${providerNames}`,
    });

    return { created, updated, providersQueried: providers.length, totalDeduped: deduped.length };
  }

  async syncCompetitions(): Promise<number> {
    const { providers } = await this.resolveAllProviders();
    if (providers.length === 0) return 0;

    const allWithMeta: Array<ExternalCompetition & { _providerId: string; _priority: number }> = [];

    for (const p of providers) {
      if (!checkRateLimit(p.instance.id, p.instance.dailyRateLimit)) continue;

      try {
        const comps = await p.instance.fetchCompetitions();
        for (const c of comps) {
          allWithMeta.push({ ...c, _providerId: p.id, _priority: p.priority });
        }
      } catch (e) {
        console.warn(`[syncCompetitions] ${p.id} failed:`, e);
      }
    }

    console.log(`[syncCompetitions] Total before dedup: ${allWithMeta.length}`);
    const deduped = dedupCompetitions(allWithMeta);
    console.log(`[syncCompetitions] After dedup: ${deduped.length}`);

    const existingSnap = await adminDb.collection("competitions").limit(500).get();
    const existingByExtId = new Map<string, DocumentReference>();
    const existingByKey = new Map<string, DocumentReference>();
    const existingByNameOnly = new Map<string, DocumentReference>();

    existingSnap.forEach((doc) => {
      const extId = doc.data().externalId as string | undefined;
      const name = doc.data().name as string | undefined;
      const country = doc.data().country as string | undefined;

      if (extId) existingByExtId.set(extId, doc.ref);
      if (name && country != null) {
        const key = normalizeCompetitionKey(name, country);
        existingByKey.set(key, doc.ref);
      }
      const provider = doc.data().source?.provider as string | undefined;
      const isMock = provider?.startsWith("mock-") || provider === "auto-mock";
      const nameOnly = normalizeName(stripSeasonSuffix(name || ""));
      if (nameOnly && !isMock) {
        if (!existingByNameOnly.has(nameOnly)) {
          existingByNameOnly.set(nameOnly, doc.ref);
        }
      }
    });

    let count = 0;

    for (const c of deduped) {
      if (!isAllowedCompetition(c.name, c.country)) {
        console.log(`[syncCompetitions] Skipping: ${c.name} (${c.country})`);
        continue;
      }

      const cleanName = stripSeasonSuffix(c.name);
      let existingRef: DocumentReference | undefined;
      if (existingByExtId.has(c.externalId)) {
        existingRef = existingByExtId.get(c.externalId);
      } else {
        const key = normalizeCompetitionKey(cleanName, c.country);
        if (existingByKey.has(key)) {
          existingRef = existingByKey.get(key);
          console.log(`[syncCompetitions] Matched by key: ${c.name} (${c.country})`);
        }
      }
      if (!existingRef) {
        const nameOnly = normalizeName(cleanName);
        if (existingByNameOnly.has(nameOnly)) {
          existingRef = existingByNameOnly.get(nameOnly);
          console.log(`[syncCompetitions] Matched by name-only: ${c.name} → ${nameOnly}`);
        }
      }

       console.log(`[syncCompetitions] Adding: ${c.name} (${c.country}) from ${c._providerId}`);
       const permanentLogo = await storeLogoPermanently(c.logoUrl, `competitions/${c._providerId}-${c.externalId}.png`);
       const teamType = c.teamType || inferCompetitionTeamType(c.name);

       const data = {
         name: cleanName, country: c.country, sport: c.sport, season: String(new Date().getFullYear()),
         logoUrl: permanentLogo, isActive: true, displayOrder: 0, externalId: c.externalId,
         teamType,
         source: {
           type: "api" as const,
           provider: c._providerId,
           originalProviders: [c._providerId, ...(c._mergedFrom || [])],
           externalId: c.externalId,
           lastSyncedAt: FieldValue.serverTimestamp(),
           lastManualEditAt: null,
         },
         manualOverrides: { enabled: false, fields: [] }, updatedAt: FieldValue.serverTimestamp(),
       };

      if (existingRef) {
        await existingRef.update(data);
      } else {
        await adminDb.collection("competitions").add({ ...data, createdAt: FieldValue.serverTimestamp() });
        count++;
      }
    }

    return count;
  }

  async syncTeams(competitionId?: string): Promise<number> {
    const { providers } = await this.resolveAllProviders();
    if (providers.length === 0) return 0;

    let count = 0;

    if (!competitionId) {
      const compSnap = await adminDb.collection("competitions").where("isActive", "==", true).get();
      console.log(`[syncTeams] Found ${compSnap.docs.length} active competitions`);

      const allTeamsSnap = await adminDb.collection("teams").get();
      const compIdsWithTeams = new Set<string>();
      allTeamsSnap.forEach((tDoc) => {
        const ids = tDoc.data().competitionIds as string[] | undefined;
        if (ids) ids.forEach((cid) => compIdsWithTeams.add(cid));
      });

       for (const compDoc of compSnap.docs) {
         const d = compDoc.data();
         const name = d.name as string;
         const nameLower = name.toLowerCase();
         const country = (d.country as string) ?? "";
         const storedTeamType = (d.teamType as string) ?? undefined;
         const inferredTeamType = inferCompetitionTeamType(name);
         const actualTeamType = storedTeamType ?? inferredTeamType;

          if (actualTeamType === "national") {
            console.log(`[syncTeams] Skipping national competition: ${name}`);
            continue;
          }

          if (compIdsWithTeams.has(compDoc.id)) {
            console.log(`[syncTeams] Skipping ${name}: already has teams`);
            continue;
          }

          const isDomesticExact = DOMESTIC_LEAGUES.has(`${name}||${country}`);
         const isDomesticWorld = DOMESTIC_LEAGUES.has(`${name}||World`);
         const isClubComp = isDomesticExact || isDomesticWorld ||
           name.includes("Premier League") ||
           name.includes("La Liga") ||
           name.includes("Bundesliga") ||
           name.includes("Serie A") ||
           name.includes("Ligue 1") ||
           name.includes("Eredivisie") ||
           name.includes("Primeira Liga") ||
           name.includes("Liga Portugal") ||
           name.includes("Süper Lig") ||
           name.includes("Super Lig") ||
           name.includes("Brasileirão") ||
           name.includes("Brasileirao") ||
           name.includes("Primera División") ||
           name.includes("Liga Profesional") ||
           name.includes("Major League Soccer") ||
           name.includes("MLS") ||
           name.includes("Liga MX") ||
           name.includes("Saudi Pro League") ||
           name.includes("Pro League") ||
           name.includes("Stars League") ||
           name.includes("Egyptian Premier") ||
           name.includes("Premier Soccer League") ||
           name.includes("Botola") ||
           name.includes("Libertadores") ||
           name.includes("Sudamericana") ||
           (name.includes("Champions League") && !nameLower.includes("women")) ||
           (name.includes("Europa League") && !nameLower.includes("women")) ||
           name.includes("Europa Conference") ||
           name.includes("UEFA Conference") ||
           name.includes("CAF Champions") ||
           name.includes("CAF Confederation") ||
           (name.includes("AFC Champions") && !nameLower.includes("women")) ||
           name.includes("AFC Cup") ||
           name.includes("Recopa") ||
           name.includes("Super Cup") ||
           name.includes("Club World Cup");

        if (!isClubComp) {
          console.log(`[syncTeams] Skipping non-club competition: ${name} (${country})`);
          continue;
        }

        const extId = d.externalId as string | undefined;
        const sourceProvider = (d.source as Record<string, unknown>)?.provider as string | undefined;

        let providerToUse: ProviderInstance | undefined;

        if (sourceProvider) {
          providerToUse = providers.find((p) => p.id === sourceProvider || p.providerType === sourceProvider);
        }

        if (!providerToUse) {
          providerToUse = providers[0];
        }

        if (!providerToUse) continue;

        const queryExtId = extId?.replace(/^(primary-|auto-|mock-)/, "") || "";

        try {
          console.log(`[syncTeams] Fetching teams for: ${name} (extId=${queryExtId}, provider=${providerToUse.id})`);
          const teams = await providerToUse.instance.fetchTeams(queryExtId || undefined);
          console.log(`[syncTeams] ${name}: got ${teams.length} teams`);

          if (teams.length === 0) continue;

          const teamsWithMeta = teams.map((t) => ({
            ...t,
            _providerId: providerToUse!.id,
            _priority: providerToUse!.priority,
          }));

          const deduped = dedupTeams(teamsWithMeta);

           for (const t of deduped) {
             const permLogo = await storeLogoPermanently(t.logoUrl, `teams/${t._providerId}-${t.externalId}.png`);
             const existing = await adminDb.collection("teams").where("externalId", "==", t.externalId).get();

             if (!existing.empty) {
               const existingData = existing.docs[0].data();
               const existingCompIds = (existingData.competitionIds as string[]) ?? [];
               const newCompIds = new Set([...existingCompIds, compDoc.id]);

               await existing.docs[0].ref.update({
                 name: t.name, shortName: t.shortName, country: t.country, sport: t.sport,
                 logoUrl: permLogo, isActive: true, isNational: t.isNational,
                 type: t.isNational ? "national" : "club",
                 competitionIds: Array.from(newCompIds),
                 "source.lastSyncedAt": FieldValue.serverTimestamp(),
                 updatedAt: FieldValue.serverTimestamp(),
               });
             } else {
               const data = {
                 name: t.name, shortName: t.shortName, country: t.country, sport: t.sport,
                 logoUrl: permLogo, isActive: true, isNational: t.isNational,
                 type: t.isNational ? "national" : "club",
                 competitionIds: [compDoc.id],
                 externalId: t.externalId,
                 source: {
                   type: "api" as const,
                   provider: t._providerId,
                   originalProviders: [t._providerId, ...(t._mergedFrom || [])],
                   externalId: t.externalId,
                   lastSyncedAt: FieldValue.serverTimestamp(),
                   lastManualEditAt: null,
                 },
                 manualOverrides: { enabled: false, fields: [] },
                 updatedAt: FieldValue.serverTimestamp(),
                 createdAt: FieldValue.serverTimestamp(),
               };
               await adminDb.collection("teams").add(data);
               count++;
             }
           }
        } catch (err) {
          console.error(`[syncTeams] Failed for ${name}:`, err);
        }
      }
      return count;
    }

    const primary = providers[0];
    if (!primary) return 0;

    const teams = await primary.instance.fetchTeams(competitionId);
    const teamsWithMeta = teams.map((t) => ({
      ...t,
      _providerId: primary.id,
      _priority: primary.priority,
    }));

    const deduped = dedupTeams(teamsWithMeta);

    for (const t of deduped) {
      const existing = await adminDb.collection("teams").where("externalId", "==", t.externalId).get();

      if (!existing.empty) {
        const existingData = existing.docs[0].data();
        const existingCompIds = (existingData.competitionIds as string[]) ?? [];
        const newCompIds = new Set([...existingCompIds, competitionId]);

        await existing.docs[0].ref.update({
          name: t.name, shortName: t.shortName, country: t.country, sport: t.sport,
          logoUrl: t.logoUrl ?? null, isActive: true, isNational: t.isNational,
          type: t.isNational ? "national" : "club",
          competitionIds: Array.from(newCompIds),
          "source.lastSyncedAt": FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      } else {
        const data = {
          name: t.name, shortName: t.shortName, country: t.country, sport: t.sport,
          logoUrl: t.logoUrl ?? null, isActive: true, isNational: t.isNational,
          type: t.isNational ? "national" : "club",
          competitionIds: [competitionId],
          externalId: t.externalId,
          source: {
            type: "api" as const,
            provider: t._providerId,
            originalProviders: [t._providerId, ...(t._mergedFrom || [])],
            externalId: t.externalId,
            lastSyncedAt: FieldValue.serverTimestamp(),
            lastManualEditAt: null,
          },
          manualOverrides: { enabled: false, fields: [] },
          updatedAt: FieldValue.serverTimestamp(),
          createdAt: FieldValue.serverTimestamp(),
        };
        await adminDb.collection("teams").add(data);
        count++;
      }
    }

    return count;
  }

  async syncNationalTeams(): Promise<number> {
    const { providers } = await this.resolveAllProviders();
    if (providers.length === 0) return 0;

    let count = 0;
    const allWithMeta: Array<ExternalTeam & { _providerId: string; _priority: number }> = [];

    for (const p of providers) {
      if (!checkRateLimit(p.instance.id, p.instance.dailyRateLimit)) continue;
      try {
        const teams = await p.instance.fetchNationalTeams();
        console.log(`[syncNationalTeams] ${p.id} returned ${teams.length} national teams`);
        for (const t of teams) {
          allWithMeta.push({ ...t, _providerId: p.id, _priority: p.priority });
        }
      } catch (e) {
        console.warn(`[syncNationalTeams] ${p.id} failed:`, e);
      }
    }

    if (allWithMeta.length === 0) {
      console.log("[syncNationalTeams] No national teams from providers, using mock fallback");
      try {
        const { createProvider } = await import("./providers/index");
        const mock = createProvider("mock", { providerId: "mock", apiKey: "mock-key", baseUrl: "" });
        const mockTeams = await mock.fetchNationalTeams();
        for (const t of mockTeams) {
          allWithMeta.push({ ...t, _providerId: "mock-fallback", _priority: 100 });
        }
      } catch (e) {
        console.warn("[syncNationalTeams] Mock fallback failed:", e);
      }
    }

    const deduped = dedupTeams(allWithMeta);

    for (const t of deduped) {
      const existing = await adminDb.collection("teams").where("externalId", "==", t.externalId).get();
      const data = {
        name: t.name, shortName: t.shortName, country: t.country, sport: t.sport,
        logoUrl: t.logoUrl ?? null, isActive: true, isNational: true, type: "national",
        competitionIds: [], externalId: t.externalId,
        source: {
          type: "api" as const,
          provider: t._providerId,
          originalProviders: [t._providerId, ...(t._mergedFrom || [])],
          externalId: t.externalId,
          lastSyncedAt: FieldValue.serverTimestamp(),
          lastManualEditAt: null,
        },
        manualOverrides: { enabled: false, fields: [] },
        updatedAt: FieldValue.serverTimestamp(),
      };

      if (!existing.empty) {
        await existing.docs[0].ref.update(data);
      } else {
        await adminDb.collection("teams").add({ ...data, createdAt: FieldValue.serverTimestamp() });
        count++;
      }
    }

    return count;
  }

  async syncStandings(): Promise<number> {
    const { providers } = await this.resolveAllProviders();
    if (providers.length === 0) return 0;

    const activeCompSnap = await adminDb.collection("competitions").where("isActive", "==", true).get();
    const activeCompetitions = activeCompSnap.docs.map((d) => ({
      id: d.id,
      externalId: d.data().externalId as string | undefined,
      name: d.data().name as string,
      logo: d.data().logoUrl as string | undefined,
      sourceProvider: (d.data().source as Record<string, unknown>)?.provider as string | undefined,
    }));

    if (activeCompetitions.length === 0) return 0;

    const activeTeamSnap = await adminDb.collection("teams").where("isActive", "==", true).get();
    const activeTeamExternalIds = new Set(
      activeTeamSnap.docs.map((d) => d.data().externalId as string | undefined).filter(Boolean) as string[]
    );

    let totalCreated = 0;

    for (const comp of activeCompetitions) {
      const extCompId = comp.externalId || "";
      if (!extCompId) continue;

      let providerToUse: ProviderInstance | undefined;

      if (comp.sourceProvider) {
        providerToUse = providers.find(
          (p) => p.id === comp.sourceProvider || p.providerType === comp.sourceProvider
        );
      }

      if (!providerToUse) {
        providerToUse = providers.find((p) => p.instance.fetchStandings);
      }

      if (!providerToUse || !providerToUse.instance.fetchStandings) continue;
      if (!checkRateLimit(providerToUse.instance.id, providerToUse.instance.dailyRateLimit)) continue;

      let standings: Awaited<ReturnType<NonNullable<typeof providerToUse.instance.fetchStandings>>> = [];
      const cleanedExtId = extCompId.replace(/^(primary-|auto-|mock-)/, "");

      try {
        standings = await providerToUse.instance.fetchStandings(cleanedExtId);
      } catch {
        continue;
      }

      for (const standing of standings) {
        const filteredTeams = standing.teams.filter((t) => {
          if (t.externalTeamId && !activeTeamExternalIds.has(t.externalTeamId)) return false;
          if (!t.externalTeamId) {
            const byName = activeTeamSnap.docs.some((d) => d.data().name === t.teamName);
            if (!byName) return false;
          }
          return true;
        });

        if (filteredTeams.length === 0) continue;

        const standingsDoc = {
          competition: {
            id: comp.id, name: comp.name, country: "", countryCode: "",
            logo: comp.logo ?? "", flagUrl: null,
            isFavorite: false, liveMatchCount: 0, todayMatchCount: 0,
          },
          season: standing.season,
          sourceProvider: providerToUse.id,
          teams: filteredTeams.map((t) => ({
            id: `pos-${t.position}`,
            position: t.position,
            team: {
              id: t.externalTeamId || t.teamName.toLowerCase().replace(/\s+/g, "-"),
              name: t.teamName,
              shortName: t.teamShortName || t.teamName.substring(0, 3).toUpperCase(),
              logo: t.teamLogoUrl || "",
            },
            played: t.played, won: t.won, drawn: t.drawn, lost: t.lost,
            goalsFor: t.goalsFor, goalsAgainst: t.goalsAgainst,
            goalDifference: t.goalDifference, points: t.points,
          })),
          updatedAt: FieldValue.serverTimestamp(),
        };

        await adminDb.collection("standings").doc(comp.id).set(standingsDoc, { merge: true });
        totalCreated++;
      }
    }

    const providerNames = providers.map((p) => p.id).join(", ");
    await createAuditLog({
      actorUid: "api-sync", actorEmail: "system@bigscore.com", action: "create", resourceType: "sync",
      description: `Multi-provider standings sync: ${totalCreated} competitions updated. Providers: ${providerNames}`,
    });

    return totalCreated;
  }

  async findAndRemoveDuplicateMatches(): Promise<{ 
    found: number; 
    merged: number; 
    deleted: number;
    duplicates: Array<{ signature: string; docs: Array<{ id: string; status: string; updatedAt?: { seconds: number } }> }>;
  }> {
    console.log("[findAndRemoveDuplicateMatches] Starting duplicate detection...");

    const allSnap = await adminDb.collection("matches").get();
    console.log(`[findAndRemoveDuplicateMatches] Total matches: ${allSnap.docs.length}`);

    const bySignature = new Map<string, Array<{ id: string; data: Record<string, unknown>; updatedAt?: { seconds: number } }>>();

    for (const doc of allSnap.docs) {
      const d = doc.data();
      const sig = matchSignatureFromFirestore(d);
      
      if (sig && !sig.startsWith("incomplete-")) {
        const updatedAt = d.updatedAt as { seconds: number } | undefined;
        if (!bySignature.has(sig)) {
          bySignature.set(sig, []);
        }
        bySignature.get(sig)!.push({ id: doc.id, data: d, updatedAt });
      }
    }

    const duplicates: Array<{ signature: string; docs: Array<{ id: string; status: string; updatedAt?: { seconds: number } }> }> = [];
    let totalDuplicatesFound = 0;

    for (const [sig, docList] of bySignature.entries()) {
      if (docList.length > 1) {
        totalDuplicatesFound += (docList.length - 1);
        duplicates.push({
          signature: sig,
          docs: docList.map((d) => ({
            id: d.id,
            status: String(d.data.status ?? "unknown"),
            updatedAt: d.updatedAt,
          })),
        });
      }
    }

    console.log(`[findAndRemoveDuplicateMatches] Found ${totalDuplicatesFound} duplicates in ${duplicates.length} groups`);
    if (duplicates.length > 0) {
      duplicates.forEach((g, idx) => {
        console.log(`  Group ${idx + 1} (${g.signature}): ${g.docs.map((d) => d.id).join(", ")}`);
      });
    }

    return {
      found: totalDuplicatesFound,
      merged: 0,
      deleted: 0,
      duplicates,
    };
  }

  async removeDuplicateMatches(dryRun: boolean = true): Promise<{
    found: number;
    deleted: number;
    kept: number;
  }> {
    const result = await this.findAndRemoveDuplicateMatches();
    if (result.duplicates.length === 0) {
      return { found: 0, deleted: 0, kept: 0 };
    }

    let deletedCount = 0;
    let keptCount = 0;
    let batch = adminDb.batch();
    let batchCount = 0;
    const maxBatchSize = 500;

    for (const group of result.duplicates) {
      const sorted = [...group.docs].sort((a, b) => {
        const statusOrder: Record<string, number> = { live: 0, halftime: 1, scheduled: 2, finished: 3 };
        const orderA = statusOrder[a.status.toLowerCase()] ?? 99;
        const orderB = statusOrder[b.status.toLowerCase()] ?? 99;
        if (orderA !== orderB) return orderA - orderB;

        const timeA = a.updatedAt?.seconds ?? 0;
        const timeB = b.updatedAt?.seconds ?? 0;
        return timeB - timeA;
      });

      const toKeep = sorted[0];
      keptCount++;

      for (let i = 1; i < sorted.length; i++) {
        const toDelete = sorted[i];
        
        if (dryRun) {
          console.log(`[removeDuplicateMatches] DRY RUN: Would delete ${toDelete.id}, keeping ${toKeep.id}`);
        } else {
          batch.delete(adminDb.collection("matches").doc(toDelete.id));
          batchCount++;
          console.log(`[removeDuplicateMatches] Deleting ${toDelete.id}, keeping ${toKeep.id}`);
        }
        deletedCount++;
      }

      if (!dryRun && batchCount >= maxBatchSize) {
        await batch.commit();
        batch = adminDb.batch();
        batchCount = 0;
      }
    }

    if (!dryRun && batchCount > 0) {
      await batch.commit();
    }

    if (dryRun) {
      console.log(`[removeDuplicateMatches] DRY RUN complete. Would delete ${deletedCount}, keep ${keptCount}`);
    } else {
      console.log(`[removeDuplicateMatches] Complete. Deleted ${deletedCount}, kept ${keptCount}`);
      
      await createAuditLog({
        actorUid: "system", actorEmail: "system@bigscore.com", action: "delete", resourceType: "match",
        description: `Removed ${deletedCount} duplicate matches (kept ${keptCount}).`,
      });
    }

    return {
      found: result.found,
      deleted: deletedCount,
      kept: keptCount,
    };
  }

  async findDuplicateCompetitions(): Promise<{
    found: number;
    groups: Array<{ key: string; name: string; docs: Array<{ id: string; name: string; country: string; logoUrl?: string; updatedAt?: { seconds: number } }> }>;
  }> {
    const allSnap = await adminDb.collection("competitions").get();
    const byKey = new Map<string, Array<{ id: string; data: Record<string, unknown> }>>();

    for (const doc of allSnap.docs) {
      const d = doc.data();
      const name = (d.name as string) || "";
      const country = (d.country as string) || "";
      const key = normalizeCompetitionKey(name, country);
      if (!byKey.has(key)) byKey.set(key, []);
      byKey.get(key)!.push({ id: doc.id, data: d });
    }

    const groups: Array<{ key: string; name: string; docs: Array<{ id: string; name: string; country: string; logoUrl?: string; updatedAt?: { seconds: number } }> }> = [];
    let totalDuplicates = 0;

    for (const [key, docs] of byKey.entries()) {
      if (docs.length > 1) {
        totalDuplicates += docs.length - 1;
        groups.push({
          key,
          name: String(docs[0].data.name ?? ""),
          docs: docs.map((d) => ({
            id: d.id,
            name: String(d.data.name ?? ""),
            country: String(d.data.country ?? ""),
            logoUrl: (d.data.logoUrl as string) ?? undefined,
            updatedAt: d.data.updatedAt as { seconds: number } | undefined,
          })),
        });
      }
    }

    return { found: totalDuplicates, groups };
  }

  async removeDuplicateCompetitions(dryRun: boolean = true): Promise<{
    found: number;
    deleted: number;
    kept: number;
  }> {
    const result = await this.findDuplicateCompetitions();
    if (result.groups.length === 0) {
      return { found: 0, deleted: 0, kept: 0 };
    }

    let deletedCount = 0;
    let keptCount = 0;
    let batch = adminDb.batch();
    let batchCount = 0;
    const maxBatchSize = 500;

    for (const group of result.groups) {
      const sorted = [...group.docs].sort((a, b) => {
        const scoreA = (a.logoUrl ? 1 : 0) + (a.updatedAt?.seconds ?? 0);
        const scoreB = (b.logoUrl ? 1 : 0) + (b.updatedAt?.seconds ?? 0);
        return scoreB - scoreA;
      });

      const toKeep = sorted[0];
      keptCount++;

      const cleanName = stripSeasonSuffix(toKeep.name);

      if (!dryRun) {
        batch.update(adminDb.collection("competitions").doc(toKeep.id), { name: cleanName });
      }

      for (let i = 1; i < sorted.length; i++) {
        const toDelete = sorted[i];
        if (dryRun) {
          console.log(`[removeDuplicateCompetitions] DRY RUN: Would delete ${toDelete.id} ("${toDelete.name}"), keeping ${toKeep.id} ("${cleanName}")`);
        } else {
          batch.delete(adminDb.collection("competitions").doc(toDelete.id));
          batchCount++;
          console.log(`[removeDuplicateCompetitions] Deleting ${toDelete.id} ("${toDelete.name}"), keeping ${toKeep.id} ("${cleanName}")`);
        }
        deletedCount++;
      }

      if (!dryRun && batchCount >= maxBatchSize) {
        await batch.commit();
        batch = adminDb.batch();
        batchCount = 0;
      }
    }

    if (!dryRun && batchCount > 0) {
      await batch.commit();
    }

    if (dryRun) {
      console.log(`[removeDuplicateCompetitions] DRY RUN complete. Would delete ${deletedCount}, keep ${keptCount}`);
    } else {
      await createAuditLog({
        actorUid: "system", actorEmail: "system@bigscore.com", action: "delete", resourceType: "competition",
        description: `Removed ${deletedCount} duplicate competitions (kept ${keptCount}), cleaned names.`,
      });
    }

    return { found: result.found, deleted: deletedCount, kept: keptCount };
  }

  async cleanupMockData(dryRun: boolean = true): Promise<{
    matchesDeleted: number;
    competitionsDeleted: number;
    teamsDeleted: number;
  }> {
    let matchesDeleted = 0;
    let competitionsDeleted = 0;
    let teamsDeleted = 0;
    let batch = adminDb.batch();
    let batchCount = 0;
    const maxBatchSize = 500;

    const mockPrefixes = ["mock-", "auto-mock", "mock-fallback"];

    const isMockDoc = (d: Record<string, unknown>): boolean => {
      const extId = String(d.externalId ?? d.externalApiMatchId ?? "");
      if (mockPrefixes.some((p) => extId.startsWith(p) || extId === p)) return true;
      const provider = String(((d.source as Record<string, unknown>)?.provider as string) ?? "");
      if (mockPrefixes.some((p) => provider.startsWith(p))) return true;
      const sourceType = String(d.sourceType ?? "");
      return sourceType === "mock";
    };

    const matchesSnap = await adminDb.collection("matches").get();
    for (const doc of matchesSnap.docs) {
      if (!isMockDoc(doc.data())) continue;
      if (dryRun) {
        matchesDeleted++;
      } else {
        batch.delete(doc.ref);
        batchCount++;
        matchesDeleted++;
        if (batchCount >= maxBatchSize) {
          await batch.commit();
          batch = adminDb.batch();
          batchCount = 0;
        }
      }
    }

    const compsSnap = await adminDb.collection("competitions").get();
    for (const doc of compsSnap.docs) {
      if (!isMockDoc(doc.data())) continue;
      if (dryRun) {
        competitionsDeleted++;
      } else {
        batch.delete(doc.ref);
        batchCount++;
        competitionsDeleted++;
        if (batchCount >= maxBatchSize) {
          await batch.commit();
          batch = adminDb.batch();
          batchCount = 0;
        }
      }
    }

    const teamsSnap = await adminDb.collection("teams").get();
    for (const doc of teamsSnap.docs) {
      if (!isMockDoc(doc.data())) continue;
      if (dryRun) {
        teamsDeleted++;
      } else {
        batch.delete(doc.ref);
        batchCount++;
        teamsDeleted++;
        if (batchCount >= maxBatchSize) {
          await batch.commit();
          batch = adminDb.batch();
          batchCount = 0;
        }
      }
    }

    if (!dryRun && batchCount > 0) {
      await batch.commit();
    }

    if (dryRun) {
      console.log(`[cleanupMockData] DRY RUN: ${matchesDeleted} matches, ${competitionsDeleted} competitions, ${teamsDeleted} teams would be deleted`);
    } else {
      await createAuditLog({
        actorUid: "system", actorEmail: "system@bigscore.com", action: "delete", resourceType: "mock",
        description: `Cleaned up ${matchesDeleted} mock matches, ${competitionsDeleted} mock competitions, ${teamsDeleted} mock teams.`,
      });
    }

    return { matchesDeleted, competitionsDeleted, teamsDeleted };
  }
}
