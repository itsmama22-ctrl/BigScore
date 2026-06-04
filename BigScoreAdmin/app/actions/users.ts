"use server";

import { adminAuth } from "@/lib/firebase/admin";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import type { AdminRole } from "@/lib/auth/permissions";
import { createAuditLog } from "@/lib/audit/createAuditLog";

interface ActionResult {
  success: boolean;
  error?: string;
}

interface Actor {
  uid: string;
  email: string;
  role: string;
}

function requireSuperAdmin(role: string): ActionResult | null {
  if (role !== "super_admin") {
    return { success: false, error: "Only super admins can manage users." };
  }
  return null;
}

const validRoles: AdminRole[] = [
  "super_admin",
  "content_manager",
  "moderator",
  "viewer",
];

// ─── Change Role ──────────────────────────────────────────────

interface ChangeRoleInput {
  targetUid: string;
  targetEmail: string;
  newRole: AdminRole;
  actor: Actor;
}

export async function changeRoleAction(
  input: ChangeRoleInput
): Promise<ActionResult> {
  const { targetUid, targetEmail, newRole, actor } = input;

  const authCheck = requireSuperAdmin(actor.role);
  if (authCheck) return authCheck;

  if (!validRoles.includes(newRole)) {
    return { success: false, error: "Invalid role." };
  }

  try {
    // Prevent demoting the last super_admin
    if (newRole !== "super_admin" && targetUid === actor.uid) {
      const superAdmins = await adminDb
        .collection("adminUsers")
        .where("role", "==", "super_admin")
        .where("status", "==", "active")
        .get();

      if (superAdmins.size <= 1) {
        return {
          success: false,
          error:
            "You are the last active super admin. Assign another super admin before changing your own role.",
        };
      }
    }

    await adminDb.collection("adminUsers").doc(targetUid).update({
      role: newRole,
      updatedAt: FieldValue.serverTimestamp(),
    });

    await createAuditLog({
      actorUid: actor.uid,
      actorEmail: actor.email,
      action: "update",
      resourceType: "adminUser",
      resourceId: targetUid,
      description: `Changed role of ${targetEmail} to ${newRole}.`,
    });

    return { success: true };
  } catch (err) {
    console.error("[changeRole]", err);
    return { success: false, error: "Failed to update role." };
  }
}

// ─── Toggle Status (Enable / Disable) ─────────────────────────

interface ToggleStatusInput {
  targetUid: string;
  targetEmail: string;
  newStatus: "active" | "disabled";
  actor: Actor;
}

export async function toggleUserStatusAction(
  input: ToggleStatusInput
): Promise<ActionResult> {
  const { targetUid, targetEmail, newStatus, actor } = input;

  const authCheck = requireSuperAdmin(actor.role);
  if (authCheck) return authCheck;

  try {
    // Prevent disabling yourself
    if (targetUid === actor.uid) {
      return { success: false, error: "You cannot disable your own account." };
    }

    // Prevent disabling the last active super_admin
    if (newStatus === "disabled") {
      const targetDoc = await adminDb
        .collection("adminUsers")
        .doc(targetUid)
        .get();

      if (targetDoc.data()?.role === "super_admin") {
        const activeSuperAdmins = await adminDb
          .collection("adminUsers")
          .where("role", "==", "super_admin")
          .where("status", "==", "active")
          .get();

        if (activeSuperAdmins.size <= 1) {
          return {
            success: false,
            error:
              "Cannot disable the last active super admin. Promote another admin first.",
          };
        }
      }
    }

    await adminDb.collection("adminUsers").doc(targetUid).update({
      status: newStatus,
      updatedAt: FieldValue.serverTimestamp(),
    });

    await adminAuth.updateUser(targetUid, {
      disabled: newStatus === "disabled",
    });

    await createAuditLog({
      actorUid: actor.uid,
      actorEmail: actor.email,
      action: "update",
      resourceType: "adminUser",
      resourceId: targetUid,
      description: `${newStatus === "disabled" ? "Disabled" : "Enabled"} user ${targetEmail}.`,
    });

    return { success: true };
  } catch (err) {
    console.error("[toggleUserStatus]", err);
    return {
      success: false,
      error: "Failed to update user status.",
    };
  }
}

// ─── Send Password Reset ──────────────────────────────────────

interface SendPasswordResetInput {
  targetEmail: string;
  actor: Actor;
}

export async function sendPasswordResetAction(
  input: SendPasswordResetInput
): Promise<ActionResult> {
  const { targetEmail, actor } = input;

  const authCheck = requireSuperAdmin(actor.role);
  if (authCheck) return authCheck;

  try {
    const link = await adminAuth.generatePasswordResetLink(targetEmail);

    // In production, send this link via email service.
    // For the admin panel, we return it so an admin can share it
    // via a secure channel. The link is single-use and expires.
    await createAuditLog({
      actorUid: actor.uid,
      actorEmail: actor.email,
      action: "update",
      resourceType: "adminUser",
      description: `Generated password reset for ${targetEmail}.`,
    });

    return { success: true, resetLink: link } as ActionResult & {
      resetLink?: string;
    };
  } catch (err) {
    console.error("[sendPasswordReset]", err);
    return {
      success: false,
      error: "Failed to generate reset link. Verify the email exists.",
    };
  }
}

// ─── Invite Admin User ────────────────────────────────────────

interface InviteUserInput {
  email: string;
  displayName: string;
  role: AdminRole;
  actor: Actor;
}

export async function inviteAdminUserAction(
  input: InviteUserInput
): Promise<ActionResult> {
  const { email, displayName, role, actor } = input;

  const authCheck = requireSuperAdmin(actor.role);
  if (authCheck) return authCheck;

  if (!validRoles.includes(role)) {
    return { success: false, error: "Invalid role." };
  }

  try {
    const existingByEmail = await adminDb
      .collection("adminUsers")
      .where("email", "==", email)
      .get();

    if (!existingByEmail.empty) {
      return {
        success: false,
        error: "An admin user with this email already exists.",
      };
    }

    let uid: string;

    try {
      const existingAuth = await adminAuth.getUserByEmail(email);
      uid = existingAuth.uid;
    } catch {
      const newUser = await adminAuth.createUser({
        email,
        displayName,
        password: Math.random().toString(36).slice(-16) + "Aa1!",
      });
      uid = newUser.uid;
    }

    await adminDb.collection("adminUsers").doc(uid).set({
      uid,
      email,
      displayName,
      role,
      status: "active",
      createdBy: actor.uid,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    const link = await adminAuth.generatePasswordResetLink(email);

    await createAuditLog({
      actorUid: actor.uid,
      actorEmail: actor.email,
      action: "create",
      resourceType: "adminUser",
      resourceId: uid,
      description: `Invited ${email} as ${role}.`,
    });

    return {
      success: true,
      resetLink: link,
    } as ActionResult & { resetLink?: string };
  } catch (err) {
    console.error("[inviteAdminUser]", err);
    return {
      success: false,
      error: "Failed to invite user. Please try again.",
    };
  }
}
