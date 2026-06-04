"use server";

import { adminDb } from "@/lib/firebase/admin";
import { teamSchema } from "@/lib/validation/teamSchema";
import { FieldValue } from "firebase-admin/firestore";
import type { TeamFormValues } from "@/lib/validation/teamSchema";

function audit(input: { actorUid: string; actorEmail: string; action: string; resourceType: string; resourceId?: string; description: string }) {
  return adminDb.collection("auditLogs").add({ ...input, createdAt: FieldValue.serverTimestamp() });
}

interface ActionResult { success: boolean; error?: string; id?: string }
interface Actor { uid: string; email: string; role: string }
function authorize(role: string) { return role === "super_admin" || role === "content_manager"; }

export async function createTeamAction(input: { data: TeamFormValues; actor: Actor }): Promise<ActionResult> {
  if (!authorize(input.actor.role)) return { success: false, error: "Permission denied." };
  const p = teamSchema.safeParse(input.data);
  if (!p.success) return { success: false, error: p.error.errors[0]?.message ?? "Invalid data." };
  try {
    const ref = await adminDb.collection("teams").add({ ...p.data, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
    await audit({ actorUid: input.actor.uid, actorEmail: input.actor.email, action: "create", resourceType: "team", resourceId: ref.id, description: `Created team "${p.data.name}".` });
    return { success: true, id: ref.id };
  } catch (err) { console.error("[team]", err); return { success: false, error: "Failed to create." }; }
}

export async function updateTeamAction(input: { teamId: string; data: TeamFormValues; actor: Actor }): Promise<ActionResult> {
  if (!authorize(input.actor.role)) return { success: false, error: "Permission denied." };
  const p = teamSchema.safeParse(input.data);
  if (!p.success) return { success: false, error: p.error.errors[0]?.message ?? "Invalid data." };
  try {
    await adminDb.collection("teams").doc(input.teamId).update({ ...p.data, updatedAt: FieldValue.serverTimestamp() });
    await audit({ actorUid: input.actor.uid, actorEmail: input.actor.email, action: "update", resourceType: "team", resourceId: input.teamId, description: `Updated team "${p.data.name}".` });
    return { success: true };
  } catch (err) { console.error("[team]", err); return { success: false, error: "Failed to update." }; }
}

export async function deleteTeamAction(input: { teamId: string; actor: Actor }): Promise<ActionResult> {
  if (!authorize(input.actor.role)) return { success: false, error: "Permission denied." };
  try {
    await adminDb.collection("teams").doc(input.teamId).delete();
    await audit({ actorUid: input.actor.uid, actorEmail: input.actor.email, action: "delete", resourceType: "team", resourceId: input.teamId, description: "Deleted a team." });
    return { success: true };
  } catch (err) { console.error("[team]", err); return { success: false, error: "Failed to delete." }; }
}
