"use server";

import { adminDb } from "@/lib/firebase/admin";
import { createProvider } from "@/lib/services/providers/index";

interface SearchResult {
  id: string;
  externalId: string;
  name: string;
  country?: string;
  league?: string;
  logoUrl?: string;
  sport?: string;
  shortName?: string;
  isNational?: boolean;
  provider: string;
}

interface SearchResponse {
  success: boolean;
  results: SearchResult[];
  error?: string;
}

function requireAuth(role: string): SearchResponse | null {
  if (role !== "super_admin" && role !== "content_manager") {
    return { success: false, results: [], error: "Permission denied." };
  }
  return null;
}

async function loadActiveProviders(): Promise<{ id: string; apiKeyEnvName: string }[]> {
  const snap = await adminDb.collection("appSettings").doc("liveMatches").get();
  const data = snap.data() ?? {};

  const providerId = (data.apiProviderName as string) || "mock";
  const envName = (data.apiKeySecretName as string) || "LIVE_SCORE_API_KEY";

  // Always include mock for fallback in dev
  return [{ id: providerId, apiKeyEnvName: envName }];
}

// ─── Competition Search ───────────────────────────────────────

export async function searchCompetitionsAction(input: {
  query: string;
  actorRole: string;
}): Promise<SearchResponse> {
  const auth = requireAuth(input.actorRole);
  if (auth) return auth;

  if (!input.query || input.query.trim().length < 1) {
    return { success: true, results: [] };
  }

  const providers = await loadActiveProviders();
  const allResults: SearchResult[] = [];
  const q = input.query.trim().toLowerCase();

  for (const p of providers) {
    try {
      const apiKey = process.env[p.apiKeyEnvName] || "mock-key";
      const provider = createProvider(p.id, { providerId: p.id, apiKey, baseUrl: "" });
      const comps = await provider.fetchCompetitions();

      for (const c of comps) {
        if (c.name.toLowerCase().includes(q)) {
          allResults.push({
            id: c.externalId,
            externalId: c.externalId,
            name: c.name,
            country: c.country,
            logoUrl: c.logoUrl,
            sport: c.sport,
            provider: p.id,
          });
        }
      }
    } catch (err) {
      console.error(`[search] Provider ${p.id} failed:`, err);
    }
  }

  return { success: true, results: allResults.slice(0, 20) };
}

// ─── Team Search ──────────────────────────────────────────────

export async function searchTeamsAction(input: {
  query: string;
  actorRole: string;
}): Promise<SearchResponse> {
  const auth = requireAuth(input.actorRole);
  if (auth) return auth;

  if (!input.query || input.query.trim().length < 1) {
    return { success: true, results: [] };
  }

  const q = input.query.trim().toLowerCase();

  // 1) Search Firestore teams first (instant, no API quota)
  try {
    const snap = await adminDb.collection("teams").limit(200).get();
    const firestoreResults: SearchResult[] = [];
    snap.forEach((d) => {
      const dt = d.data();
      const name = (dt.name as string) ?? "";
      const short = (dt.shortName as string) ?? "";
      if (name.toLowerCase().includes(q) || short.toLowerCase().includes(q)) {
        firestoreResults.push({
          id: d.id, externalId: dt.externalId ?? d.id,
          name, country: (dt.country as string) ?? "",
          logoUrl: dt.logoUrl as string, sport: (dt.sport as string) ?? "Football",
          shortName: short, isNational: (dt.isNational as boolean) ?? false,
          provider: "firestore",
        });
      }
    });
    if (firestoreResults.length > 0) {
      return { success: true, results: firestoreResults.slice(0, 20) };
    }
  } catch (err) {
    console.error("[search] Firestore teams search failed:", err);
  }

  // 2) Fallback: Direct API team name search
  const providers = await loadActiveProviders();
  for (const p of providers) {
    try {
      const apiKey = process.env[p.apiKeyEnvName] || "mock-key";
      const provider = createProvider(p.id, { providerId: p.id, apiKey, baseUrl: "" });

      const [clubTeams, nationalTeams] = await Promise.all([
        provider.fetchTeams().catch(() => []),
        provider.fetchNationalTeams().catch(() => []),
      ]);

      const allTeams = [...clubTeams, ...nationalTeams];
      const matching = allTeams.filter(
        (t) => t.name.toLowerCase().includes(q) || t.shortName.toLowerCase().includes(q)
      );
      if (matching.length > 0) {
        return {
          success: true,
          results: matching.slice(0, 20).map((t) => ({
            id: t.externalId, externalId: t.externalId,
            name: t.name, country: t.country, logoUrl: t.logoUrl,
            sport: t.sport, shortName: t.shortName,
            isNational: t.isNational, provider: p.id,
          })),
        };
      }
    } catch (err) {
      console.error(`[search] API provider ${p.id} failed:`, err);
    }
  }

  return { success: true, results: [] };
}

// ─── Duplicate Check ──────────────────────────────────────────

export async function checkDuplicateAction(input: {
  collection: "competitions" | "teams";
  externalId: string;
  name: string;
  actorRole: string;
}): Promise<{ exists: boolean; error?: string }> {
  const auth = requireAuth(input.actorRole);
  if (auth) return { exists: false, error: "Permission denied." };

  try {
    const byExternalId = await adminDb
      .collection(input.collection)
      .where("externalId", "==", input.externalId)
      .get();

    if (!byExternalId.empty) return { exists: true };

    const byName = await adminDb
      .collection(input.collection)
      .where("name", "==", input.name)
      .get();

    if (!byName.empty) return { exists: true };

    return { exists: false };
  } catch (err) {
    return { exists: false, error: err instanceof Error ? err.message : "Check failed." };
  }
}
