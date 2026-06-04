export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { SportsAPIManager } from "@/lib/services/sportsApiManager";

async function verifyAuth(request: Request): Promise<boolean> {
  if (process.env.NODE_ENV === "development") return true;
  const url = new URL(request.url);
  const cronSecret = request.headers.get("x-sync-secret") || url.searchParams.get("secret");
  const isCron = cronSecret && process.env.LIVE_SYNC_SECRET && cronSecret === process.env.LIVE_SYNC_SECRET;

  const isVercelCron = request.headers.get("x-vercel-cron") === "1";
  if (isVercelCron || isCron) return true;

  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    try {
      const { getAuth } = await import("firebase-admin/auth");
      const token = await getAuth().verifyIdToken(authHeader.slice(7));
      return token.uid != null;
    } catch { /* */ }
  }

  return false;
}

export async function POST(request: Request) {
  if (!(await verifyAuth(request))) {
    return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 401 });
  }

  const url = new URL(request.url);
  const mode = url.searchParams.get("mode") || "full";

  const result = await runSync(mode);

  if (!result.success && result.error) {
    return NextResponse.json(result, { status: 500 });
  }

  return NextResponse.json({
    ...result,
    timestamp: new Date().toISOString(),
  });
}

async function runSync(mode: string = "full"): Promise<{
  success: boolean;
  created: number;
  updated: number;
  error?: string;
}> {
  try {
    const manager = SportsAPIManager.getInstance();
    const result = await manager.syncLiveMatches(mode);

    const { adminDb } = await import("@/lib/firebase/admin");
    await adminDb.collection("appSettings").doc("liveMatches").set(
      {
        lastSyncAt: new Date(),
        lastSyncStatus: "success",
        lastSyncError: null,
        lastSyncResult: { created: result.created, updated: result.updated },
      },
      { merge: true }
    );

    return {
      success: true,
      created: result.created,
      updated: result.updated,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown sync error";

    const { adminDb } = await import("@/lib/firebase/admin");
    await adminDb.collection("appSettings").doc("liveMatches").set(
      {
        lastSyncAt: new Date(),
        lastSyncStatus: "failed",
        lastSyncError: message,
      },
      { merge: true }
    );

    return { success: false, created: 0, updated: 0, error: message };
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const triggerSync = url.searchParams.get("sync") === "1";
  const cleanup = url.searchParams.get("cleanup");
  const dryRun = url.searchParams.get("dryrun") === "1" || cleanup === "dryrun";
  const doCleanup = cleanup === "1" || cleanup === "execute";

  if (triggerSync) {
    if (!(await verifyAuth(request))) {
      return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 401 });
    }

    const mode = url.searchParams.get("mode") || "full";

    const result = await runSync(mode);

    if (!result.success && result.error) {
      return NextResponse.json(result, { status: 500 });
    }

    return NextResponse.json({
      ...result,
      timestamp: new Date().toISOString(),
    });
  }

  if (doCleanup || dryRun) {
    if (!(await verifyAuth(request))) {
      return NextResponse.json({ success: false, error: "Unauthorized. Add ?secret=YOUR_LIVE_SYNC_SECRET" }, { status: 401 });
    }

    const manager = SportsAPIManager.getInstance();

    if (dryRun) {
      const result = await manager.findAndRemoveDuplicateMatches();
      return NextResponse.json({
        success: true,
        dryRun: true,
        duplicatesFound: result.found,
        duplicateGroups: result.duplicates.length,
        duplicates: result.duplicates.map((g) => ({
          signature: g.signature,
          matches: g.docs.map((d) => ({
            id: d.id,
            status: d.status,
          })),
        })),
        message: "This is a dry run. Add ?cleanup=execute to actually delete duplicates.",
      });
    }

    const result = await manager.removeDuplicateMatches(false);
    return NextResponse.json({
      success: true,
      duplicatesFound: result.found,
      deleted: result.deleted,
      kept: result.kept,
    });
  }

  const { adminDb } = await import("@/lib/firebase/admin");
  const snap = await adminDb.collection("appSettings").doc("liveMatches").get();
  if (!snap.exists) {
    return NextResponse.json({ lastSyncAt: null, lastSyncStatus: "never" });
  }
  const data = snap.data()!;
  return NextResponse.json({
    lastSyncAt: data.lastSyncAt ?? null,
    lastSyncStatus: data.lastSyncStatus ?? "never",
    lastSyncError: data.lastSyncError ?? null,
    lastSyncResult: data.lastSyncResult ?? null,
    scheduledMatchAvailability: data.scheduledMatchAvailability ?? null,
  });
}
