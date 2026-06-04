"use server";

import { SportsAPIManager } from "@/lib/services/sportsApiManager";
import { createAuditLog } from "@/lib/audit/createAuditLog";
import { createProvider } from "@/lib/services/providers/index";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

interface ActionResult {
  success: boolean;
  error?: string;
  stats?: {
    created: number;
    updated: number;
    provider: string;
  };
}

interface Actor { uid: string; email: string; role: string }

function requireSuperAdmin(role: string): ActionResult | null {
  return role !== "super_admin"
    ? { success: false, error: "Only super admins can manage API syncs." }
    : null;
}

// ─── Sync triggers ────────────────────────────────────────────

export async function syncLiveResultsAction(input: { actor: Actor }): Promise<ActionResult> {
  const auth = requireSuperAdmin(input.actor.role);
  if (auth) return auth;

  try {
    const manager = SportsAPIManager.getInstance();
    const result = await manager.syncLiveMatches();

    await createAuditLog({
      actorUid: input.actor.uid, actorEmail: input.actor.email,
      action: "update", resourceType: "sync",
      description: `Manual sync: live results (${result.created} created, ${result.updated} updated).`,
    });

    return { success: true, stats: { ...result, provider: "live" } };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Sync failed." };
  }
}

export async function syncCompetitionsAction(input: { actor: Actor }): Promise<ActionResult> {
  const auth = requireSuperAdmin(input.actor.role);
  if (auth) return auth;

  try {
    const manager = SportsAPIManager.getInstance();
    const count = await manager.syncCompetitions();

    await adminDb.collection("appSettings").doc("syncStatus").set({
      competitionsLastSyncAt: new Date(),
      competitionsLastResult: { created: count, updated: 0 },
    }, { merge: true });

    await createAuditLog({
      actorUid: input.actor.uid, actorEmail: input.actor.email,
      action: "update", resourceType: "sync",
      description: `Manual sync: competitions (${count} created).`,
    });

    return { success: true, stats: { created: count, updated: 0, provider: "competitions" } };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Sync failed." };
  }
}

export async function syncTeamsAction(input: { actor: Actor; competitionId?: string }): Promise<ActionResult> {
  const auth = requireSuperAdmin(input.actor.role);
  if (auth) return auth;

  try {
    const manager = SportsAPIManager.getInstance();
    const count = await manager.syncTeams(input.competitionId);

    await adminDb.collection("appSettings").doc("syncStatus").set({
      teamsLastSyncAt: new Date(),
      teamsLastResult: { created: count, updated: 0 },
    }, { merge: true });

    await createAuditLog({
      actorUid: input.actor.uid, actorEmail: input.actor.email,
      action: "update", resourceType: "sync",
      description: `Manual sync: teams (${count} created).`,
    });

    return { success: true, stats: { created: count, updated: 0, provider: "teams" } };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Sync failed." };
  }
}

export async function syncNationalTeamsAction(input: { actor: Actor }): Promise<ActionResult> {
  const auth = requireSuperAdmin(input.actor.role);
  if (auth) return auth;

  try {
    const manager = SportsAPIManager.getInstance();
    const count = await manager.syncNationalTeams();

    await adminDb.collection("appSettings").doc("syncStatus").set({
      teamsLastSyncAt: new Date(),
      teamsLastResult: { created: count, updated: 0 },
    }, { merge: true });

    await createAuditLog({
      actorUid: input.actor.uid, actorEmail: input.actor.email,
      action: "update", resourceType: "sync",
      description: `Manual sync: national teams (${count} created).`,
    });

    return { success: true, stats: { created: count, updated: 0, provider: "teams" } };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Sync failed." };
  }
}

export async function syncStandingsAction(input: { actor: Actor }): Promise<ActionResult> {
  const auth = requireSuperAdmin(input.actor.role);
  if (auth) return auth;

  try {
    const manager = SportsAPIManager.getInstance();
    const count = await manager.syncStandings();

    await createAuditLog({
      actorUid: input.actor.uid, actorEmail: input.actor.email,
      action: "update", resourceType: "sync",
      description: `Manual sync: standings (${count} competitions updated).`,
    });

    return { success: true, stats: { created: count, updated: 0, provider: "standings" } };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Sync failed." };
  }
}

// ─── Test connection ──────────────────────────────────────────

export async function testProviderConnectionAction(input: {
  providerId: string;
  apiKeyEnvName: string;
  actor: Actor;
}): Promise<ActionResult & { message?: string }> {
  const auth = requireSuperAdmin(input.actor.role);
  if (auth) return auth;

  try {
    const apiKey = process.env[input.apiKeyEnvName] || "mock-key";
    const provider = createProvider(input.providerId, {
      providerId: input.providerId,
      apiKey,
      baseUrl: "",
    });

    const result = await provider.testConnection();

    return { success: result.success, message: result.message };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Test failed." };
  }
}
