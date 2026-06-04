"use server";

import { adminDb } from "@/lib/firebase/admin";
import { newsSchema } from "@/lib/validation/newsSchema";
import { FieldValue } from "firebase-admin/firestore";
import type { NewsFormValues } from "@/lib/validation/newsSchema";
import { createAuditLog } from "@/lib/audit/createAuditLog";

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

interface CreateNewsInput {
  data: NewsFormValues;
  actor: Actor;
}

export async function createNewsAction(input: CreateNewsInput): Promise<ActionResult> {
  const { data, actor } = input;

  if (!authorizeWrite(actor.role)) {
    return { success: false, error: "You do not have permission to create articles." };
  }

  const parsed = newsSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "Invalid data." };
  }

  try {
    const docRef = await adminDb.collection("news").add({
      ...parsed.data,
      publishedAt: parsed.data.publishedAt ? new Date(parsed.data.publishedAt) : null,
      createdBy: actor.uid,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    await createAuditLog({
      actorUid: actor.uid,
      actorEmail: actor.email,
      action: "create",
      resourceType: "news",
      resourceId: docRef.id,
      description: `Created article "${parsed.data.title}".`,
    });

    return { success: true, id: docRef.id };
  } catch (err) {
    console.error("[createNews]", err);
    return { success: false, error: "Failed to create article." };
  }
}

interface UpdateNewsInput {
  articleId: string;
  data: NewsFormValues;
  actor: Actor;
}

export async function updateNewsAction(input: UpdateNewsInput): Promise<ActionResult> {
  const { articleId, data, actor } = input;

  if (!authorizeWrite(actor.role)) {
    return { success: false, error: "You do not have permission to update articles." };
  }

  const parsed = newsSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "Invalid data." };
  }

  try {
    await adminDb.collection("news").doc(articleId).update({
      ...parsed.data,
      publishedAt: parsed.data.publishedAt ? new Date(parsed.data.publishedAt) : null,
      updatedAt: FieldValue.serverTimestamp(),
    });

    await createAuditLog({
      actorUid: actor.uid,
      actorEmail: actor.email,
      action: "update",
      resourceType: "news",
      resourceId: articleId,
      description: `Updated article "${parsed.data.title}".`,
    });

    return { success: true, id: articleId };
  } catch (err) {
    console.error("[updateNews]", err);
    return { success: false, error: "Failed to update article." };
  }
}

interface DeleteNewsInput {
  articleId: string;
  actor: Actor;
}

export async function deleteNewsAction(input: DeleteNewsInput): Promise<ActionResult> {
  const { articleId, actor } = input;

  if (!authorizeWrite(actor.role)) {
    return { success: false, error: "You do not have permission to delete articles." };
  }

  try {
    await adminDb.collection("news").doc(articleId).delete();

    await createAuditLog({
      actorUid: actor.uid,
      actorEmail: actor.email,
      action: "delete",
      resourceType: "news",
      resourceId: articleId,
      description: "Deleted an article.",
    });

    return { success: true };
  } catch (err) {
    console.error("[deleteNews]", err);
    return { success: false, error: "Failed to delete article." };
  }
}
