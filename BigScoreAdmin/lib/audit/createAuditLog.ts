import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

export type AuditAction =
  | "login"
  | "create"
  | "update"
  | "delete"
  | "send_notification"
  | "schedule_notification"
  | "change_role"
  | "disable_user"
  | "update_config"
  | "update_stream_url"
  | "publish"
  | "unpublish"
  | "toggle_feature";

export interface CreateAuditLogInput {
  actorUid: string;
  actorEmail: string;
  action: AuditAction;
  resourceType: string;
  resourceId?: string;
  description: string;
  metadata?: Record<string, unknown>;
}

/**
 * Centralized audit log creator.
 * All server actions should import this instead of defining their own
 * createAuditLog function. This ensures consistent logging format,
 * error handling, and makes it easy to add transports later.
 */
export async function createAuditLog(input: CreateAuditLogInput): Promise<void> {
  const {
    actorUid,
    actorEmail,
    action,
    resourceType,
    resourceId,
    description,
    metadata,
  } = input;

  if (!actorUid || !actorEmail || !action || !resourceType || !description) {
    console.warn("[audit] Incomplete audit log entry skipped.", { actorUid, action, resourceType });
    return;
  }

  try {
    await adminDb.collection("auditLogs").add({
      actorUid,
      actorEmail,
      action,
      resourceType,
      resourceId: resourceId ?? null,
      description,
      metadata: metadata ?? null,
      createdAt: FieldValue.serverTimestamp(),
    });
  } catch (err) {
    console.error("[audit] Failed to write audit log:", err);
    // Non-blocking — never throw from audit logging to avoid breaking
    // the primary operation.
  }
}
