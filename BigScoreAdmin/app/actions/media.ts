"use server";

import { adminDb } from "@/lib/firebase/admin";
import { mediaSchema } from "@/lib/validation/mediaSchema";
import { FieldValue } from "firebase-admin/firestore";
import type { MediaFormValues } from "@/lib/validation/mediaSchema";

async function createAuditLog(input: {
  actorUid: string;
  actorEmail: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  description: string;
}) {
  await adminDb.collection("auditLogs").add({
    ...input,
    createdAt: FieldValue.serverTimestamp(),
  });
}

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

function authorizeWrite(role: string): boolean {
  return role === "super_admin" || role === "content_manager";
}

// ─── Feature Toggle ───────────────────────────────────────────

interface ToggleFeatureInput {
  enabled: boolean;
  actor: Actor;
}

export async function toggleMoviesFeatureAction(
  input: ToggleFeatureInput
): Promise<ActionResult> {
  const { enabled, actor } = input;

  if (actor.role !== "super_admin") {
    return {
      success: false,
      error: "Only super admins can change this setting.",
    };
  }

  try {
    const snapshot = await adminDb
      .collection("appSettings")
      .where("__name__", "==", "features")
      .get();

    if (snapshot.empty) {
      await adminDb.collection("appSettings").doc("features").set({
        enableMoviesSeries: enabled,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: actor.uid,
      });
    } else {
      await snapshot.docs[0].ref.update({
        enableMoviesSeries: enabled,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: actor.uid,
      });
    }

    await createAuditLog({
      actorUid: actor.uid,
      actorEmail: actor.email,
      action: "update",
      resourceType: "appSettings",
      resourceId: "features",
      description: `${enabled ? "Enabled" : "Disabled"} Movies & Series feature.`,
    });

    return { success: true };
  } catch (err) {
    console.error("[toggleMoviesFeature]", err);
    return { success: false, error: "Failed to update feature toggle." };
  }
}

// ─── Media CRUD ───────────────────────────────────────────────

interface CreateMediaInput {
  data: MediaFormValues;
  actor: Actor;
}

export async function createMediaAction(
  input: CreateMediaInput
): Promise<ActionResult> {
  const { data, actor } = input;

  if (!authorizeWrite(actor.role)) {
    return {
      success: false,
      error: "You do not have permission to create media content.",
    };
  }

  const parsed = mediaSchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0]?.message ?? "Invalid media data.",
    };
  }

  try {
    const payload = {
      ...parsed.data,
      createdBy: actor.uid,
      updatedBy: actor.uid,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      licenseExpiresAt: parsed.data.licenseExpiresAt
        ? new Date(parsed.data.licenseExpiresAt)
        : null,
    };

    const docRef = await adminDb.collection("mediaContent").add(payload);

    await createAuditLog({
      actorUid: actor.uid,
      actorEmail: actor.email,
      action: "create",
      resourceType: "mediaContent",
      resourceId: docRef.id,
      description: `Created ${parsed.data.type}: "${parsed.data.title}".`,
    });

    return { success: true, id: docRef.id };
  } catch (err) {
    console.error("[createMedia]", err);
    return { success: false, error: "Failed to create media content." };
  }
}

interface UpdateMediaInput {
  mediaId: string;
  data: MediaFormValues;
  actor: Actor;
}

export async function updateMediaAction(
  input: UpdateMediaInput
): Promise<ActionResult> {
  const { mediaId, data, actor } = input;

  if (!authorizeWrite(actor.role)) {
    return {
      success: false,
      error: "You do not have permission to update media content.",
    };
  }

  const parsed = mediaSchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0]?.message ?? "Invalid media data.",
    };
  }

  try {
    const payload = {
      ...parsed.data,
      updatedBy: actor.uid,
      updatedAt: FieldValue.serverTimestamp(),
      licenseExpiresAt: parsed.data.licenseExpiresAt
        ? new Date(parsed.data.licenseExpiresAt)
        : null,
    };

    await adminDb.collection("mediaContent").doc(mediaId).update(payload);

    await createAuditLog({
      actorUid: actor.uid,
      actorEmail: actor.email,
      action: "update",
      resourceType: "mediaContent",
      resourceId: mediaId,
      description: `Updated ${parsed.data.type}: "${parsed.data.title}".`,
    });

    return { success: true, id: mediaId };
  } catch (err) {
    console.error("[updateMedia]", err);
    return { success: false, error: "Failed to update media content." };
  }
}

interface DeleteMediaInput {
  mediaId: string;
  actor: Actor;
}

export async function deleteMediaAction(
  input: DeleteMediaInput
): Promise<ActionResult> {
  const { mediaId, actor } = input;

  if (!authorizeWrite(actor.role)) {
    return {
      success: false,
      error: "You do not have permission to delete media content.",
    };
  }

  try {
    await adminDb.collection("mediaContent").doc(mediaId).delete();

    await createAuditLog({
      actorUid: actor.uid,
      actorEmail: actor.email,
      action: "delete",
      resourceType: "mediaContent",
      resourceId: mediaId,
      description: "Deleted media content.",
    });

    return { success: true };
  } catch (err) {
    console.error("[deleteMedia]", err);
    return { success: false, error: "Failed to delete media content." };
  }
}
