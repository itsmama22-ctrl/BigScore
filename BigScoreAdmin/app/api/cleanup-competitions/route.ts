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
  const dryRun = url.searchParams.get("dryrun") !== "false";
  const execute = url.searchParams.get("execute") === "true";

  try {
    const manager = SportsAPIManager.getInstance();

    if (execute) {
      const result = await manager.removeDuplicateCompetitions(false);
      return NextResponse.json({
        success: true,
        action: "executed",
        dryRun: false,
        ...result,
        timestamp: new Date().toISOString(),
      });
    }

    const result = await manager.findDuplicateCompetitions();
    return NextResponse.json({
      success: true,
      action: dryRun ? "dryrun" : "found",
      dryRun,
      ...result,
      hint: dryRun
        ? `Pass ?execute=true to actually delete duplicates, or ?dryrun=false&execute=true`
        : "Pass ?execute=true to delete duplicates",
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!(await verifyAuth(request))) {
    return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 401 });
  }

  const url = new URL(request.url);
  const dryRun = url.searchParams.get("dryrun") !== "false";

  try {
    const manager = SportsAPIManager.getInstance();
    const result = await manager.removeDuplicateCompetitions(dryRun);
    return NextResponse.json({
      success: true,
      dryRun,
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
