"use server";

import { adminDb } from "@/lib/firebase/admin";
import { createAuditLog } from "@/lib/audit/createAuditLog";
import { createNewsProvider } from "@/lib/services/newsApiProvider";
import { FieldValue } from "firebase-admin/firestore";
import type { NewsApiProviderConfig } from "@/models/newsArticle";

interface ActionResult { success: boolean; error?: string }

interface Actor { uid: string; email: string; role: string }

function requireSuperAdmin(role: string): ActionResult | null {
  if (role !== "super_admin") return { success: false, error: "Only super admins can modify news API configuration." };
  return null;
}

export async function saveNewsApiConfigAction(input: {
  apis: NewsApiProviderConfig[];
  actor: Actor;
}): Promise<ActionResult> {
  const authCheck = requireSuperAdmin(input.actor.role);
  if (authCheck) return authCheck;

  try {
    // Mask all API keys before saving — never store real keys in Firestore
    const maskedApis = input.apis.map((api) => ({
      ...api,
      apiKeyMasked: api.apiKeySecretName ? `env:${api.apiKeySecretName}` : "",
    }));

    const existing = await adminDb.collection("appSettings").doc("newsApi").get();

    if (existing.exists) {
      await existing.ref.update({
        apis: maskedApis,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: input.actor.uid,
        updatedByEmail: input.actor.email,
      });
    } else {
      await adminDb.collection("appSettings").doc("newsApi").set({
        apis: maskedApis,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: input.actor.uid,
        updatedByEmail: input.actor.email,
      });
    }

    await createAuditLog({
      actorUid: input.actor.uid,
      actorEmail: input.actor.email,
      action: "update_config",
      resourceType: "appSettings",
      resourceId: "newsApi",
      description: `Updated news API configuration (${maskedApis.length} providers).`,
    });

    return { success: true };
  } catch (err) {
    console.error("[saveNewsApiConfig]", err);
    return { success: false, error: "Failed to save configuration." };
  }
}

 export async function testNewsApiConnectionAction(input: {
   config: NewsApiProviderConfig;
   actor: Actor;
 }): Promise<ActionResult & { message?: string }> {
   const authCheck = requireSuperAdmin(input.actor.role);
   if (authCheck) return authCheck;

   try {
     const provider = createNewsProvider({
       ...input.config,
       apiKeySecretName: input.config.apiKeySecretName,
       apiKeyMasked: input.config.apiKeyMasked,
     } as NewsApiProviderConfig);
     const result = await provider.testConnection();
     return { success: result.success, message: result.message };
   } catch (err) {
     return { success: false, error: err instanceof Error ? err.message : "Connection test failed." };
   }
 }
