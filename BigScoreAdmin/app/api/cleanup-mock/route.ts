export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { SportsAPIManager } from "@/lib/services/sportsApiManager";

async function verifyAuth(request: Request): Promise<boolean> {
  const url = new URL(request.url);
  const secret = request.headers.get("x-sync-secret") || url.searchParams.get("secret");
  const cronSecret = process.env.LIVE_SYNC_SECRET;
  if (secret && cronSecret && secret === cronSecret) return true;

  const isVercelCron = request.headers.get("x-vercel-cron") === "1";
  if (isVercelCron) return true;

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

export async function GET(request: Request) {
  if (!(await verifyAuth(request))) {
    return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 401 });
  }

  const url = new URL(request.url);
  const execute = url.searchParams.get("execute") === "true";

  try {
    const manager = SportsAPIManager.getInstance();

    if (execute) {
      const result = await manager.cleanupMockData(false);
      return NextResponse.json({
        success: true,
        action: "executed",
        ...result,
        timestamp: new Date().toISOString(),
      });
    }

    const result = await manager.cleanupMockData(true);
    return NextResponse.json({
      success: true,
      action: "dryrun",
      dryRun: true,
      ...result,
      hint: "Pass ?execute=true to actually delete mock data.",
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
