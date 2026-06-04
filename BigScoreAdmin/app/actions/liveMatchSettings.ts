"use server";

import { adminDb } from "@/lib/firebase/admin";
import { liveMatchSettingsSchema } from "@/lib/validation/liveMatchSettingsSchema";
import { createAuditLog } from "@/lib/audit/createAuditLog";
import { FieldValue } from "firebase-admin/firestore";
import type { LiveMatchSettingsFormValues } from "@/lib/validation/liveMatchSettingsSchema";
import { createProvider } from "@/lib/services/liveScoreProvider";

interface ActionResult { success: boolean; error?: string }

interface Actor { uid: string; email: string; role: string }

function requireSuperAdmin(role: string): ActionResult | null {
  if (role !== "super_admin") return { success: false, error: "Only super admins can modify live match settings." };
  return null;
}

export async function saveLiveMatchSettingsAction(input: {
  settings: LiveMatchSettingsFormValues;
  actor: Actor;
}): Promise<ActionResult> {
  const authCheck = requireSuperAdmin(input.actor.role);
  if (authCheck) return authCheck;

  const parsed = liveMatchSettingsSchema.safeParse(input.settings);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "Invalid settings data." };
  }

  try {
    const existing = await adminDb.collection("appSettings").doc("liveMatches").get();
    const oldData = existing.data();

    // Mask the API key — never store the real key in Firestore.
    // The actual key lives in environment variables.
    const apiKeyMasked = parsed.data.apiKeySecretName
      ? `env:${parsed.data.apiKeySecretName}`
      : oldData?.apiKeyMasked ?? "";

    const payload = {
      ...parsed.data,
      apiKeyMasked,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: input.actor.uid,
      updatedByEmail: input.actor.email,
    };

    if (existing.exists) {
      await existing.ref.update(payload);
    } else {
      await adminDb.collection("appSettings").doc("liveMatches").set({
        ...payload,
        lastSyncStatus: "never",
      });
    }

    await createAuditLog({
      actorUid: input.actor.uid,
      actorEmail: input.actor.email,
      action: "update_config",
      resourceType: "appSettings",
      resourceId: "liveMatches",
      description: `Updated live match settings (mode: ${parsed.data.liveMatchesSourceMode}).`,
    });

    return { success: true };
  } catch (err) {
    console.error("[saveLiveMatchSettings]", err);
    return { success: false, error: "Failed to save settings." };
  }
}

export async function testApiConnectionAction(input: {
  actor: Actor;
}): Promise<ActionResult & { message?: string }> {
  const authCheck = requireSuperAdmin(input.actor.role);
  if (authCheck) return authCheck;

  try {
    const doc = await adminDb.collection("appSettings").doc("liveMatches").get();
    if (!doc.exists) return { success: false, error: "Settings not configured." };

    const data = doc.data()!;
    const providerName = (data.apiProviderName as string) || "mock";
    const apiKeySecretName = (data.apiKeySecretName as string) || "";
    const apiKey = process.env[apiKeySecretName] || process.env.LIVE_SCORE_API_KEY || "mock-key";
    const apiBaseUrl = (data.apiBaseUrl as string) || "";

    const provider = createProvider(providerName, { providerId: providerName, apiKey, baseUrl: apiBaseUrl });
    const result = await provider.testConnection();

    return { success: result.success, message: result.message };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Connection test failed.",
    };
  }
}
