export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getMessaging } from "firebase-admin/messaging";
import { FieldValue } from "firebase-admin/firestore";

async function verifyAuth(request: Request): Promise<boolean> {
  if (process.env.NODE_ENV === "development") return true;
  const cronSecret = request.headers.get("x-sync-secret") ||
    new URL(request.url).searchParams.get("secret");
  const isCron = cronSecret && process.env.LIVE_SYNC_SECRET &&
    cronSecret === process.env.LIVE_SYNC_SECRET;
  if (isCron) return true;
  if (request.headers.get("x-vercel-cron") === "1") return true;
  return false;
}

export async function GET(request: Request) {
  if (!(await verifyAuth(request))) {
    return NextResponse.json(
      { success: false, error: "Unauthorized." },
      { status: 401 }
    );
  }

  try {
    const now = new Date();
    const snap = await adminDb
      .collection("notifications")
      .where("status", "==", "scheduled")
      .where("scheduledAt", "<=", now)
      .get();

    if (snap.empty) {
      return NextResponse.json({
        success: true,
        dispatched: 0,
        message: "No scheduled notifications due.",
      });
    }

    // Fetch all device tokens once
    const tokensSnap = await adminDb.collection("deviceTokens").get();
    const allDeviceDocs = tokensSnap.docs;

    const messaging = getMessaging();
    let dispatched = 0;
    let failed = 0;

    const batch = adminDb.batch();

    for (const doc of snap.docs) {
      const data = doc.data();

      // Determine language filter from the stored targetedLangs field
      const targetedLangs = (data.targetedLangs as string) || "all";
      const langFilter = targetedLangs === "all" ? null : targetedLangs.split(",");

      // Filter tokens to only those matching the notification's languages
      const tokens = allDeviceDocs
        .filter((d) => {
          if (!langFilter) return true;
          const deviceLang = (d.data().appLanguage as string) || "en";
          return langFilter.includes(deviceLang);
        })
        .map((d) => d.data().fcmToken as string | undefined)
        .filter((t): t is string => !!t);

      const dataPayload: Record<string, string> = {
        type: data.notificationType ?? "announcement",
        title_en: data.title_en ?? "",
        body_en: data.body_en ?? "",
        title_ar: data.title_ar ?? "",
        body_ar: data.body_ar ?? "",
        title_fr: data.title_fr ?? "",
        body_fr: data.body_fr ?? "",
      };

      // Use first non-empty language for the system notification banner
      const notifTitle = data.title_en || data.title_ar || data.title_fr || "BigScore";
      const notifBody = data.body_en || data.body_ar || data.body_fr || "";

      const recipientCount = tokens.length;
      let deliveredCount = 0;
      let failedCount = 0;

      // FCM limit is 500 tokens per multicast call
      const chunkSize = 500;
      for (let i = 0; i < tokens.length; i += chunkSize) {
        const chunk = tokens.slice(i, i + chunkSize);
        try {
          const response = await messaging.sendEachForMulticast({
            notification: {
              title: notifTitle,
              body: notifBody,
            },
            data: dataPayload,
            tokens: chunk,
          });
          deliveredCount += response.successCount;
          failedCount += response.failureCount;
        } catch (err) {
          console.warn(`[dispatch-notifications] Multicast failed for ${doc.id}:`, err);
          failedCount += chunk.length;
        }
      }

      batch.update(doc.ref, {
        status: "sent",
        sentAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        recipientCount,
        deliveredCount,
        failedCount,
      });
      dispatched += deliveredCount;
      failed += failedCount;
    }

    await batch.commit();

    return NextResponse.json({
      success: true,
      dispatched,
      failed,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[dispatch-notifications]", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  return GET(request);
}
