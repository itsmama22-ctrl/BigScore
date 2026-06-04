"use server";

import { notificationSchema } from "@/lib/validation/notificationSchema";
import type { NotificationFormValues } from "@/lib/validation/notificationSchema";
import { createAuditLog } from "@/lib/audit/createAuditLog";
import { addDocument, updateDocument, getDocuments } from "@/lib/firestore-api";

const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!;

interface ActionResult {
  success: boolean;
  error?: string;
  id?: string;
}

interface Actor {
  uid: string;
  email: string;
  role: string;
}

function authorize(role: string): boolean {
  return role === "super_admin" || role === "moderator";
}

// ─── Send Notification ────────────────────────────────────────

interface SendNotificationInput {
  data: NotificationFormValues;
  actor: Actor;
}

export async function sendNotificationAction(
  input: SendNotificationInput
): Promise<ActionResult> {
  const { data, actor } = input;

  if (!authorize(actor.role)) {
    return {
      success: false,
      error: "You do not have permission to send notifications.",
    };
  }

  const parsed = notificationSchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0]?.message ?? "Invalid notification data.",
    };
  }

  // These fields come from the form but aren't in the zod schema
  const formType = (data as unknown as Record<string, string>).type ?? "";
  const rawTargetedLangs = (data as unknown as Record<string, string[]>).targetedLanguages ?? [];
  const isScheduled = !!(data as unknown as Record<string, string>).scheduledAt || formType === "scheduled";
  const filterByLang = formType === "targeted_languages" || isScheduled;
  const targetedLangs = rawTargetedLangs;
  const providedLangs = filterByLang && targetedLangs.length > 0
    ? targetedLangs
    : ["en", "ar", "fr"];

  // Create the notification document
  let docId: string | null;
  try {
    docId = await addDocument("notifications", {
      type: parsed.data.notificationType,
      title_en: parsed.data.title_en,
      body_en: parsed.data.body_en,
      title_ar: parsed.data.title_ar,
      body_ar: parsed.data.body_ar,
      title_fr: parsed.data.title_fr,
      body_fr: parsed.data.body_fr,
      status: isScheduled ? "scheduled" : "sent",
      sentBy: actor.uid,
      sentByEmail: actor.email,
      targetedLangs,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    if (!docId) throw new Error("Failed to create notification");
  } catch (writeErr) {
    const wErr = writeErr instanceof Error ? writeErr.message : String(writeErr);
    console.error("[N1]", wErr);
    return { success: false, error: "Failed to create notification: " + wErr };
  }

  // Fetch all device tokens and filter by language
  let allTokens: string[];
  try {
    const tokenDocs = await getDocuments("deviceTokens");
    allTokens = tokenDocs
      .filter((d: { id: string; data: Record<string, unknown> }) => {
        if (!filterByLang) return true;
        const deviceLang = (d.data.appLanguage as string) || "en";
        return providedLangs.includes(deviceLang);
      })
      .map((d: { id: string; data: Record<string, unknown> }) => d.data.fcmToken as string | undefined)
      .filter((t: string | undefined): t is string => !!t);
  } catch (tokensErr) {
    const tErr = tokensErr instanceof Error ? tokensErr.message : String(tokensErr);
    console.error("[N2]", tErr);
    return { success: false, error: "Failed to fetch device tokens: " + tErr };
  }

  const recipientCount = allTokens.length;

  if (!isScheduled && allTokens.length > 0) {
    try {
      let messaging: { sendEachForMulticast: (msg: Record<string, unknown>) => Promise<{ successCount: number; failureCount: number }> } | null = null;
      try {
        const { getMessaging } = await import("firebase-admin/messaging");
        const m = getMessaging();
        messaging = { sendEachForMulticast: (msg) => m.sendEachForMulticast(msg as never) };
      } catch (msgErr) {
        const mErr = msgErr instanceof Error ? msgErr.message : String(msgErr);
        console.error("[N3]", mErr);
      }

      if (messaging) {
        await sendViaAdminSdk(messaging, parsed, allTokens, docId);
      } else {
        await sendViaFcmRest(parsed, allTokens);
      }

      try {
        await updateDocument("notifications", docId, {
          recipientCount,
          deliveredCount: 0,
          failedCount: 0,
        });
      } catch (updErr) {
        const uErr = updErr instanceof Error ? updErr.message : String(updErr);
        console.error("[N5]", uErr);
      }
    } catch (fcmErr) {
      const fErr = fcmErr instanceof Error ? fcmErr.message : String(fcmErr);
      console.warn("[sendNotification] FCM error (notification still saved):", fErr);
    }
  }

  try {
    await createAuditLog({
      actorUid: actor.uid,
      actorEmail: actor.email,
      action: isScheduled ? "schedule_notification" : "send_notification",
      resourceType: "notification",
      resourceId: docId,
      description: `${
        isScheduled ? "Scheduled" : "Sent"
      } notification "${parsed.data.notificationType}" to ${
        filterByLang ? targetedLangs.join(", ") : "all languages"
      } (${recipientCount} recipients)`,
    });
  } catch {
    console.warn("[audit] Failed to create audit log");
  }

  return {
    success: true,
    id: docId,
  };
}

async function sendViaAdminSdk(
  messaging: { sendEachForMulticast: (msg: Record<string, unknown>) => Promise<{ successCount: number; failureCount: number }> },
  parsed: { data: { notificationType: string; title_en?: string; body_en?: string; title_ar?: string; body_ar?: string; title_fr?: string; body_fr?: string } },
  allTokens: string[],
  docId: string
) {
  const dataPayload: Record<string, string> = {
    type: parsed.data.notificationType,
    title_en: parsed.data.title_en ?? "",
    body_en: parsed.data.body_en ?? "",
    title_ar: parsed.data.title_ar ?? "",
    body_ar: parsed.data.body_ar ?? "",
    title_fr: parsed.data.title_fr ?? "",
    body_fr: parsed.data.body_fr ?? "",
  };

  const notifTitle = parsed.data.title_en || parsed.data.title_ar || parsed.data.title_fr || "BigScore";
  const notifBody = parsed.data.body_en || parsed.data.body_ar || parsed.data.body_fr || "";

  const chunkSize = 500;
  let deliveredCount = 0;
  let failedCount = 0;

  for (let i = 0; i < allTokens.length; i += chunkSize) {
    const chunk = allTokens.slice(i, i + chunkSize);
    let response;
    try {
      response = await messaging.sendEachForMulticast({
        notification: { title: notifTitle, body: notifBody },
        data: dataPayload,
        tokens: chunk,
      });
    } catch (fcmErr) {
      const fErr = fcmErr instanceof Error ? fcmErr.message : String(fcmErr);
      console.error("[N4]", fErr);
      continue;
    }
    deliveredCount += response.successCount;
    failedCount += response.failureCount;
  }

  try {
    await updateDocument("notifications", docId, {
      recipientCount: allTokens.length,
      deliveredCount,
      failedCount,
    });
  } catch (updErr) {
    const uErr = updErr instanceof Error ? updErr.message : String(updErr);
    console.error("[N5]", uErr);
  }
}

async function sendViaFcmRest(
  parsed: { data: { notificationType: string; title_en?: string; body_en?: string; title_ar?: string; body_ar?: string; title_fr?: string; body_fr?: string } },
  allTokens: string[]
) {
  const key = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const email = process.env.FIREBASE_CLIENT_EMAIL;
  if (!key || !email) throw new Error("Missing FCM credentials");

  const { JWT } = await import("google-auth-library");
  const jwtClient = new JWT({
    email,
    key,
    scopes: ["https://www.googleapis.com/auth/firebase.messaging"],
  });
  const tokenRes = await jwtClient.getAccessToken();
  const bearer = tokenRes?.token;
  if (!bearer) throw new Error("Failed to get FCM access token");

  const notifTitle = parsed.data.title_en || parsed.data.title_ar || parsed.data.title_fr || "BigScore";
  const notifBody = parsed.data.body_en || parsed.data.body_ar || parsed.data.body_fr || "";

  const chunkSize = 500;
  for (let i = 0; i < allTokens.length; i += chunkSize) {
    const chunk = allTokens.slice(i, i + chunkSize);
    const res = await fetch(
      `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${bearer}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          validate_only: false,
          message: {
            notification: { title: notifTitle, body: notifBody },
            data: {
              type: parsed.data.notificationType,
              title_en: parsed.data.title_en ?? "",
            },
            tokens: chunk,
          },
        }),
      }
    );
    if (!res.ok) {
      const err = await res.text().catch(() => "");
      console.error("[N4] FCM REST error", res.status, err.slice(0, 300));
    }
  }
}

export async function getNotificationsAction() {
  try {
    const docs = await getDocuments("notifications", {
      orderByField: "createdAt",
      orderByDir: "desc",
      limitCount: 100,
    });
    return docs.map((d: { id: string; data: Record<string, unknown> }) => {
      const data = d.data;
      return {
        id: d.id,
        type: data.type ?? "",
        title_en: data.title_en ?? "",
        body_en: data.body_en ?? "",
        title_ar: data.title_ar ?? "",
        body_ar: data.body_ar ?? "",
        title_fr: data.title_fr ?? "",
        body_fr: data.body_fr ?? "",
        status: data.status ?? "",
        sentBy: data.sentBy ?? "",
        sentByEmail: data.sentByEmail ?? "",
        recipientCount: (data.recipientCount as number) ?? 0,
        deliveredCount: (data.deliveredCount as number) ?? 0,
        failedCount: (data.failedCount as number) ?? 0,
        createdAt: data.createdAt ?? null,
      };
    });
  } catch (err) {
    console.error("[getNotificationsAction]", err);
    return [];
  }
}

// ─── Send scheduled notifications ─────────────────────────────

export async function dispatchScheduledNotificationsAction() {
  try {
    const docs = await getDocuments("notifications");
    const scheduled = docs.filter((d: { id: string; data: Record<string, unknown> }) => {
      const scheduledAt = d.data.scheduledAt as string;
      return scheduledAt && new Date(scheduledAt) <= new Date();
    });

    let dispatched = 0;
    for (const notif of scheduled) {
      const tokenDocs = await getDocuments("deviceTokens");
      const tokens = tokenDocs.map((t: { id: string; data: Record<string, unknown> }) => t.data.fcmToken as string).filter(Boolean);
      if (tokens.length > 0) {
        await sendViaFcmRest(
          { data: notif.data as unknown as NotificationFormValues },
          tokens
        );
      }
      await updateDocument("notifications", notif.id, {
        status: "sent",
        sentAt: new Date().toISOString(),
      });
      dispatched++;
    }

    return { success: true, dispatched };
  } catch (err) {
    console.error("[dispatchScheduled]", err);
    return { success: false, error: String(err) };
  }
}
