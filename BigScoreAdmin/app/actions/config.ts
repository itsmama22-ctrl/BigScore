"use server";

import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { createAuditLog } from "@/lib/audit/createAuditLog";

export type LiveTabMode = "live_tv" | "live_matches" | "packages";

export interface AppSettingsData {
  enableSportPackages: boolean;
  liveTabMode: LiveTabMode;
  enableMoviesSeries: boolean;
  enableLiveWatchButton: boolean;
  enableAdMob: boolean;
  enableAppOpenAds: boolean;
  enableInterstitialAds: boolean;
  enableNews: boolean;
  enablePushNotifications: boolean;
  showTeamLogos: boolean;
  maintenanceMode: boolean;
  maintenanceMessage: string;
  minimumSupportedVersion: string;
  forceUpdateEnabled: boolean;
}

interface UpdateConfigInput {
  settings: AppSettingsData;
  actorUid: string;
  actorEmail: string;
  actorRole: string;
}

interface ConfigActionResult {
  success: boolean;
  error?: string;
}

export async function updateAppConfigAction(
  input: UpdateConfigInput
): Promise<ConfigActionResult> {
  const { settings, actorUid, actorEmail, actorRole } = input;

  if (actorRole !== "super_admin") {
    return {
      success: false,
      error: "Only super admins can modify app configuration.",
    };
  }

  try {
    const payload = {
      ...settings,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: actorUid,
      updatedByEmail: actorEmail,
    };

    const snapshot = await adminDb
      .collection("appSettings")
      .where("__name__", "==", "config")
      .get();

    if (snapshot.empty) {
      await adminDb.collection("appSettings").doc("config").set(payload);
    } else {
      await snapshot.docs[0].ref.update(payload);
    }

    await createAuditLog({
      actorUid,
      actorEmail,
      action: "update",
      resourceType: "appSettings",
      resourceId: "config",
      description: "Updated app configuration settings.",
      metadata: { settingsChanged: Object.keys(settings).length },
    });

    return { success: true };
  } catch (err) {
    console.error("[updateAppConfig]", err);
    return {
      success: false,
      error: "Failed to save configuration. Please try again.",
    };
  }
}
