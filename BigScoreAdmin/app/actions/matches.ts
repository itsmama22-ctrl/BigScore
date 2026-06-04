"use server";

import { adminDb } from "@/lib/firebase/admin";
import { matchSchema } from "@/lib/validation/matchSchema";
import { FieldValue } from "firebase-admin/firestore";
import type { MatchFormValues } from "@/lib/validation/matchSchema";
import { createAuditLog } from "@/lib/audit/createAuditLog";

interface ServerActionResult {
  success: boolean;
  error?: string;
  id?: string;
}

interface ToggleWatchModeInput {
  matchId: string;
  enabled: boolean;
  actorUid: string;
  actorEmail: string;
  actorRole: string;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function formatTimeString(date: Date): string {
  const hours = pad2(date.getUTCHours());
  const minutes = pad2(date.getUTCMinutes());
  return `${hours}:${minutes}`;
}

function toUTCDate(dateStr: string): Date {
  if (dateStr.includes("Z") || dateStr.includes("+")) {
    return new Date(dateStr);
  }
  return new Date(dateStr + "Z");
}

interface FirestoreDocumentData {
  [key: string]: unknown;
}

async function getNextDisplayOrder(): Promise<number> {
  const snapshot = await adminDb
    .collection("matches")
    .orderBy("displayOrder", "asc")
    .limit(1)
    .get();

  if (snapshot.empty) return 0;

  const lowest = snapshot.docs[0].data().displayOrder as number;
  return lowest - 1;
}

function cleanStreamsForFirestore(streams: MatchFormValues["streams"]): Array<Record<string, unknown>> {
  return streams.map((s) => {
    const result: Record<string, unknown> = {
      language: s.language,
      label: s.label,
      url: s.url,
      isEnabled: s.isEnabled,
      order: s.order,
    };
    if (s.quality) {
      result.quality = s.quality;
    }
    return result;
  });
}

export async function toggleWatchModeAction(
  input: ToggleWatchModeInput
): Promise<ServerActionResult> {
  const { matchId, enabled, actorUid, actorEmail, actorRole } = input;

  if (actorRole !== "super_admin" && actorRole !== "content_manager") {
    return { success: false, error: "You do not have permission to update matches." };
  }

  try {
    await adminDb.collection("matches").doc(matchId).update({
      enableWatchMode: enabled,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: actorUid,
    });

    await createAuditLog({
      actorUid,
      actorEmail,
      action: "update",
      resourceType: "match",
      resourceId: matchId,
      description: `${enabled ? "Enabled" : "Disabled"} watch mode for match.`,
    });

    return { success: true };
  } catch (err) {
    console.error("[toggleWatchMode]", err);
    return { success: false, error: "Failed to update watch mode. Please try again." };
  }
}

interface DeleteMatchInput {
  matchId: string;
  actorUid: string;
  actorEmail: string;
  actorRole: string;
}

export async function deleteMatchAction(
  input: DeleteMatchInput
): Promise<ServerActionResult> {
  const { matchId, actorUid, actorEmail, actorRole } = input;

  if (actorRole !== "super_admin" && actorRole !== "content_manager") {
    return { success: false, error: "You do not have permission to delete matches." };
  }

  try {
    await adminDb.collection("matches").doc(matchId).delete();

    await createAuditLog({
      actorUid,
      actorEmail,
      action: "delete",
      resourceType: "match",
      resourceId: matchId,
      description: "Deleted a match.",
    });

    return { success: true };
  } catch (err) {
    console.error("[deleteMatch]", err);
    return { success: false, error: "Failed to delete match. Please try again." };
  }
}

interface CreateMatchInput {
  data: MatchFormValues;
  actorUid: string;
  actorEmail: string;
  actorRole: string;
}

export async function createMatchAction(
  input: CreateMatchInput
): Promise<ServerActionResult> {
  const { data, actorUid, actorEmail, actorRole } = input;

  if (actorRole !== "super_admin" && actorRole !== "content_manager") {
    return { success: false, error: "You do not have permission to create matches." };
  }

  const parsed = matchSchema.safeParse(data);

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0]?.message ?? "Invalid match data.",
    };
  }

  try {
    const [compDoc, homeDoc, awayDoc] = await Promise.all([
      adminDb.collection("competitions").doc(parsed.data.competitionId).get(),
      adminDb.collection("teams").doc(parsed.data.homeTeamId).get(),
      adminDb.collection("teams").doc(parsed.data.awayTeamId).get(),
    ]);

    const compData = compDoc.data() as FirestoreDocumentData | undefined;
    const homeData = homeDoc.data() as FirestoreDocumentData | undefined;
    const awayData = awayDoc.data() as FirestoreDocumentData | undefined;

    const startDateVal = toUTCDate(parsed.data.startDate);
    const timeString = formatTimeString(startDateVal);

    const competition = {
      id: parsed.data.competitionId,
      name: (compData?.name as string) ?? parsed.data.competitionId,
      country: (compData?.country as string) ?? "",
      countryCode: (compData?.countryCode as string) ?? "",
      logo: (compData?.logo as string) ?? (compData?.logoUrl as string) ?? "",
      flagUrl: (compData?.flagUrl as string) ?? null,
      isFavorite: false,
      liveMatchCount: 0,
      todayMatchCount: 0,
    };

    const homeTeam = {
      id: parsed.data.homeTeamId,
      name: (homeData?.name as string) ?? parsed.data.homeTeamId,
      shortName: (homeData?.shortName as string) ?? (homeData?.name as string) ?? "",
      logo: (homeData?.logo as string) ?? (homeData?.logoUrl as string) ?? "",
    };

    const awayTeam = {
      id: parsed.data.awayTeamId,
      name: (awayData?.name as string) ?? parsed.data.awayTeamId,
      shortName: (awayData?.shortName as string) ?? (awayData?.name as string) ?? "",
      logo: (awayData?.logo as string) ?? (awayData?.logoUrl as string) ?? "",
    };

    const displayOrder = await getNextDisplayOrder();

    const payload = {
      ...parsed.data,
      streams: cleanStreamsForFirestore(parsed.data.streams),
      competitionName: competition.name,
      homeTeamName: homeTeam.name,
      awayTeamName: awayTeam.name,
      startDate: startDateVal,
      date: startDateVal,
      time: timeString,
      competition,
      homeTeam,
      awayTeam,
      licenseExpiresAt: parsed.data.licenseExpiresAt
        ? toUTCDate(parsed.data.licenseExpiresAt)
        : null,
      displayOrder,
      createdBy: actorUid,
      updatedBy: actorUid,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    const docRef = await adminDb.collection("matches").add(payload);

    await createAuditLog({
      actorUid,
      actorEmail,
      action: "create",
      resourceType: "match",
      resourceId: docRef.id,
      description: `Created match: ${payload.homeTeamName} vs ${payload.awayTeamName}.`,
    });

    return { success: true, id: docRef.id };
  } catch (err) {
    console.error("[createMatch]", err);
    return { success: false, error: "Failed to create match. Please try again." };
  }
}

interface UpdateMatchInput {
  matchId: string;
  data: MatchFormValues;
  actorUid: string;
  actorEmail: string;
  actorRole: string;
}

export async function updateMatchAction(
  input: UpdateMatchInput
): Promise<ServerActionResult> {
  const { matchId, data, actorUid, actorEmail, actorRole } = input;

  if (actorRole !== "super_admin" && actorRole !== "content_manager") {
    return { success: false, error: "You do not have permission to update matches." };
  }

  const parsed = matchSchema.safeParse(data);

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0]?.message ?? "Invalid match data.",
    };
  }

  try {
    const [compDoc, homeDoc, awayDoc] = await Promise.all([
      adminDb.collection("competitions").doc(parsed.data.competitionId).get(),
      adminDb.collection("teams").doc(parsed.data.homeTeamId).get(),
      adminDb.collection("teams").doc(parsed.data.awayTeamId).get(),
    ]);

    const compData = compDoc.data() as FirestoreDocumentData | undefined;
    const homeData = homeDoc.data() as FirestoreDocumentData | undefined;
    const awayData = awayDoc.data() as FirestoreDocumentData | undefined;

    const startDateVal = toUTCDate(parsed.data.startDate);
    const timeString = formatTimeString(startDateVal);

    const competition = {
      id: parsed.data.competitionId,
      name: (compData?.name as string) ?? parsed.data.competitionId,
      country: (compData?.country as string) ?? "",
      countryCode: (compData?.countryCode as string) ?? "",
      logo: (compData?.logo as string) ?? (compData?.logoUrl as string) ?? "",
      flagUrl: (compData?.flagUrl as string) ?? null,
      isFavorite: false,
      liveMatchCount: 0,
      todayMatchCount: 0,
    };

    const homeTeam = {
      id: parsed.data.homeTeamId,
      name: (homeData?.name as string) ?? parsed.data.homeTeamId,
      shortName: (homeData?.shortName as string) ?? (homeData?.name as string) ?? "",
      logo: (homeData?.logo as string) ?? (homeData?.logoUrl as string) ?? "",
    };

    const awayTeam = {
      id: parsed.data.awayTeamId,
      name: (awayData?.name as string) ?? parsed.data.awayTeamId,
      shortName: (awayData?.shortName as string) ?? (awayData?.name as string) ?? "",
      logo: (awayData?.logo as string) ?? (awayData?.logoUrl as string) ?? "",
    };

    const displayOrder = await getNextDisplayOrder();

    const payload = {
      ...parsed.data,
      streams: cleanStreamsForFirestore(parsed.data.streams),
      competitionName: competition.name,
      homeTeamName: homeTeam.name,
      awayTeamName: awayTeam.name,
      startDate: startDateVal,
      date: startDateVal,
      time: timeString,
      competition,
      homeTeam,
      awayTeam,
      licenseExpiresAt: parsed.data.licenseExpiresAt
        ? toUTCDate(parsed.data.licenseExpiresAt)
        : null,
      displayOrder,
      updatedBy: actorUid,
      updatedAt: FieldValue.serverTimestamp(),
    };

    await adminDb.collection("matches").doc(matchId).update(payload);

    await createAuditLog({
      actorUid,
      actorEmail,
      action: "update",
      resourceType: "match",
      resourceId: matchId,
      description: `Updated match: ${payload.homeTeamName} vs ${payload.awayTeamName}.`,
    });

    return { success: true, id: matchId };
  } catch (err) {
    console.error("[updateMatch]", err);
    return { success: false, error: "Failed to update match. Please try again." };
  }
}
