"use server";

import { adminDb } from "@/lib/firebase/admin";
import { competitionSchema } from "@/lib/validation/competitionSchema";
import { FieldValue } from "firebase-admin/firestore";
import type { CompetitionFormValues } from "@/lib/validation/competitionSchema";

function audit(input: { actorUid: string; actorEmail: string; action: string; resourceType: string; resourceId?: string; description: string }) {
  return adminDb.collection("auditLogs").add({ ...input, createdAt: FieldValue.serverTimestamp() });
}

interface ActionResult { success: boolean; error?: string; id?: string }
interface Actor { uid: string; email: string; role: string }
function authorize(role: string) { return role === "super_admin" || role === "content_manager"; }

export async function createCompetitionAction(input: { data: CompetitionFormValues; actor: Actor }): Promise<ActionResult> {
  if (!authorize(input.actor.role)) return { success: false, error: "Permission denied." };
  const p = competitionSchema.safeParse(input.data);
  if (!p.success) return { success: false, error: p.error.errors[0]?.message ?? "Invalid data." };
  try {
    const ref = await adminDb.collection("competitions").add({ ...p.data, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
    await audit({ actorUid: input.actor.uid, actorEmail: input.actor.email, action: "create", resourceType: "competition", resourceId: ref.id, description: `Created competition "${p.data.name}".` });
    return { success: true, id: ref.id };
  } catch (err) { console.error("[competition]", err); return { success: false, error: "Failed to create." }; }
}

export async function updateCompetitionAction(input: { compId: string; data: CompetitionFormValues; actor: Actor }): Promise<ActionResult> {
  if (!authorize(input.actor.role)) return { success: false, error: "Permission denied." };
  const p = competitionSchema.safeParse(input.data);
  if (!p.success) return { success: false, error: p.error.errors[0]?.message ?? "Invalid data." };
  try {
    await adminDb.collection("competitions").doc(input.compId).update({ ...p.data, updatedAt: FieldValue.serverTimestamp() });
    await audit({ actorUid: input.actor.uid, actorEmail: input.actor.email, action: "update", resourceType: "competition", resourceId: input.compId, description: `Updated competition "${p.data.name}".` });
    return { success: true };
  } catch (err) { console.error("[competition]", err); return { success: false, error: "Failed to update." }; }
}

export async function deleteCompetitionAction(input: { compId: string; actor: Actor }): Promise<ActionResult> {
  if (!authorize(input.actor.role)) return { success: false, error: "Permission denied." };
  try {
    await adminDb.collection("competitions").doc(input.compId).delete();
    await audit({ actorUid: input.actor.uid, actorEmail: input.actor.email, action: "delete", resourceType: "competition", resourceId: input.compId, description: "Deleted a competition." });
    return { success: true };
  } catch (err) { console.error("[competition]", err); return { success: false, error: "Failed to delete." }; }
}
