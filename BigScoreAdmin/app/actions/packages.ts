"use server";

import { adminDb } from "@/lib/firebase/admin";
import { packageSchema, channelSchema } from "@/lib/validation/packageSchema";
import { FieldValue } from "firebase-admin/firestore";
import type { PackageFormValues, ChannelFormValues } from "@/lib/validation/packageSchema";
import { getDocuments } from "@/lib/firestore-api";

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

// ─── Channel CRUD ──────────────────────────────────────────────

interface ChannelInput {
  packageId: string;
  data: ChannelFormValues;
  actor: Actor;
}

export async function createChannelAction(
  input: ChannelInput
): Promise<ActionResult> {
  const { packageId, data, actor } = input;

  if (!authorizeWrite(actor.role)) {
    return { success: false, error: "You do not have permission to create channels." };
  }

  const parsed = channelSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "Invalid channel data." };
  }

  try {
    const channelRef = await adminDb
      .collection("packages")
      .doc(packageId)
      .collection("channels")
      .add({
        ...parsed.data,
        streamUrls: [],
        licenseExpiresAt: parsed.data.licenseExpiresAt
          ? new Date(parsed.data.licenseExpiresAt)
          : null,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

    await adminDb.collection("packages").doc(packageId).update({
      channelCount: FieldValue.increment(1),
      updatedBy: actor.uid,
      updatedAt: FieldValue.serverTimestamp(),
    });

    await createAuditLog({
      actorUid: actor.uid,
      actorEmail: actor.email,
      action: "create",
      resourceType: "channel",
      resourceId: channelRef.id,
      description: `Created channel "${parsed.data.name}".`,
    });

    return { success: true, id: channelRef.id };
  } catch (err) {
    console.error("[createChannel]", err);
    return { success: false, error: "Failed to create channel." };
  }
}

interface UpdateChannelInput {
  packageId: string;
  channelId: string;
  data: ChannelFormValues;
  actor: Actor;
}

export async function updateChannelAction(
  input: UpdateChannelInput
): Promise<ActionResult> {
  const { packageId, channelId, data, actor } = input;

  if (!authorizeWrite(actor.role)) {
    return { success: false, error: "You do not have permission to update channels." };
  }

  const parsed = channelSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "Invalid channel data." };
  }

  try {
    await adminDb
      .collection("packages")
      .doc(packageId)
      .collection("channels")
      .doc(channelId)
      .update({
        ...parsed.data,
        licenseExpiresAt: parsed.data.licenseExpiresAt
          ? new Date(parsed.data.licenseExpiresAt)
          : null,
        updatedAt: FieldValue.serverTimestamp(),
      });

    await createAuditLog({
      actorUid: actor.uid,
      actorEmail: actor.email,
      action: "update",
      resourceType: "channel",
      resourceId: channelId,
      description: `Updated channel "${parsed.data.name}".`,
    });

    return { success: true };
  } catch (err) {
    console.error("[updateChannel]", err);
    return { success: false, error: "Failed to update channel." };
  }
}

interface DeleteChannelInput {
  packageId: string;
  channelId: string;
  channelName: string;
  actor: Actor;
}

export async function deleteChannelAction(
  input: DeleteChannelInput
): Promise<ActionResult> {
  const { packageId, channelId, channelName, actor } = input;

  if (!authorizeWrite(actor.role)) {
    return { success: false, error: "You do not have permission to delete channels." };
  }

  try {
    await adminDb
      .collection("packages")
      .doc(packageId)
      .collection("channels")
      .doc(channelId)
      .delete();

    await adminDb.collection("packages").doc(packageId).update({
      channelCount: FieldValue.increment(-1),
      updatedBy: actor.uid,
      updatedAt: FieldValue.serverTimestamp(),
    });

    await createAuditLog({
      actorUid: actor.uid,
      actorEmail: actor.email,
      action: "delete",
      resourceType: "channel",
      resourceId: channelId,
      description: `Deleted channel "${channelName}".`,
    });

    return { success: true };
  } catch (err) {
    console.error("[deleteChannel]", err);
    return { success: false, error: "Failed to delete channel." };
  }
}

// ─── Package CRUD ──────────────────────────────────────────────

interface CreatePackageInput {
  data: PackageFormValues;
  channels: ChannelFormValues[];
  actor: Actor;
}

export async function createPackageAction(
  input: CreatePackageInput
): Promise<ActionResult> {
  const { data, channels, actor } = input;

  if (!authorizeWrite(actor.role)) {
    return { success: false, error: "You do not have permission to create packages." };
  }

  const parsed = packageSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "Invalid package data." };
  }

  try {
    const docRef = await adminDb.collection("packages").add({
      ...parsed.data,
      channelCount: channels.filter((ch) => ch.name.trim()).length,
      createdBy: actor.uid,
      updatedBy: actor.uid,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    for (const ch of channels) {
      if (!ch.name.trim()) continue;

      const chParsed = channelSchema.safeParse(ch);
      if (!chParsed.success) continue;

      const chStreamUrls = (ch as Record<string, unknown>).streamUrls as string[] | undefined;

      await adminDb
        .collection("packages")
        .doc(docRef.id)
        .collection("channels")
        .add({
          ...chParsed.data,
          streamUrls: chStreamUrls?.filter((u) => u.trim()) ?? [],
          licenseExpiresAt: chParsed.data.licenseExpiresAt
            ? new Date(chParsed.data.licenseExpiresAt)
            : null,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
    }

    await createAuditLog({
      actorUid: actor.uid,
      actorEmail: actor.email,
      action: "create",
      resourceType: "package",
      resourceId: docRef.id,
      description: `Created package "${parsed.data.name}".`,
    });

    return { success: true, id: docRef.id };
  } catch (err) {
    console.error("[createPackage]", err);
    return { success: false, error: "Failed to create package." };
  }
}

interface UpdatePackageBasicInput {
  packageId: string;
  data: PackageFormValues;
  actor: Actor;
}

interface UpdatePackageInput {
  packageId: string;
  data: PackageFormValues;
  channels: ChannelFormValues[];
  actor: Actor;
}

export async function updatePackageAction(
  input: UpdatePackageInput
): Promise<ActionResult> {
  const { packageId, data, channels, actor } = input;

  if (!authorizeWrite(actor.role)) {
    return { success: false, error: "You do not have permission to update packages." };
  }

  const parsed = packageSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "Invalid package data." };
  }

  try {
    await adminDb.collection("packages").doc(packageId).update({
      ...parsed.data,
      channelCount: channels.filter((ch) => ch.name.trim()).length,
      updatedBy: actor.uid,
      updatedAt: FieldValue.serverTimestamp(),
    });

    const existingSnap = await adminDb
      .collection("packages")
      .doc(packageId)
      .collection("channels")
      .get();

    const existingIds = new Set(existingSnap.docs.map((d) => d.id));

    for (const ch of channels) {
      if (!ch.name.trim()) continue;

      const chParsed = channelSchema.safeParse(ch);
      if (!chParsed.success) continue;

      const chStreamUrls = (ch as Record<string, unknown>).streamUrls as string[] | undefined;

      const chData = {
        ...chParsed.data,
        streamUrls: chStreamUrls?.filter((u) => u.trim()) ?? [],
        licenseExpiresAt: chParsed.data.licenseExpiresAt
          ? new Date(chParsed.data.licenseExpiresAt)
          : null,
        updatedAt: FieldValue.serverTimestamp(),
      };

      const channelId = (ch as ChannelFormValues & { id?: string }).id;

      if (channelId && existingIds.has(channelId)) {
        existingIds.delete(channelId);
        await adminDb
          .collection("packages")
          .doc(packageId)
          .collection("channels")
          .doc(channelId)
          .update(chData);
      } else {
        await adminDb
          .collection("packages")
          .doc(packageId)
          .collection("channels")
          .add({
            ...chData,
            createdAt: FieldValue.serverTimestamp(),
          });
      }
    }

    for (const removedId of existingIds) {
      await adminDb
        .collection("packages")
        .doc(packageId)
        .collection("channels")
        .doc(removedId)
        .delete();
    }

    await createAuditLog({
      actorUid: actor.uid,
      actorEmail: actor.email,
      action: "update",
      resourceType: "package",
      resourceId: packageId,
      description: `Updated package "${parsed.data.name}".`,
    });

    return { success: true, id: packageId };
  } catch (err) {
    console.error("[updatePackage]", err);
    return { success: false, error: "Failed to update package." };
  }
}

// ─── Package Basic Update (no channel sync) ────────────────────

export async function updatePackageBasicAction(
  input: UpdatePackageBasicInput
): Promise<ActionResult> {
  const { packageId, data, actor } = input;

  if (!authorizeWrite(actor.role)) {
    return { success: false, error: "You do not have permission to update packages." };
  }

  const parsed = packageSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "Invalid package data." };
  }

  try {
    await adminDb.collection("packages").doc(packageId).update({
      ...parsed.data,
      updatedBy: actor.uid,
      updatedAt: FieldValue.serverTimestamp(),
    });

    await createAuditLog({
      actorUid: actor.uid,
      actorEmail: actor.email,
      action: "update",
      resourceType: "package",
      resourceId: packageId,
      description: `Updated package "${parsed.data.name}".`,
    });

    return { success: true, id: packageId };
  } catch (err) {
    console.error("[updatePackageBasic]", err);
    return { success: false, error: "Failed to update package." };
  }
}

// ─── Reorder Packages ─────────────────────────────────────────

interface ReorderPackagesInput {
  orderedIds: string[];
  actor: Actor;
}

export async function reorderPackagesAction(
  input: ReorderPackagesInput
): Promise<ActionResult> {
  const { orderedIds, actor } = input;

  if (!authorizeWrite(actor.role)) {
    return { success: false, error: "You do not have permission to reorder packages." };
  }

  try {
    const batch = adminDb.batch();
    orderedIds.forEach((id, index) => {
      batch.update(adminDb.collection("packages").doc(id), {
        displayOrder: index,
        updatedBy: actor.uid,
        updatedAt: FieldValue.serverTimestamp(),
      });
    });
    await batch.commit();

    await createAuditLog({
      actorUid: actor.uid,
      actorEmail: actor.email,
      action: "update",
      resourceType: "package",
      resourceId: orderedIds.join(","),
      description: "Reordered packages.",
    });

    return { success: true };
  } catch (err) {
    console.error("[reorderPackages]", err);
    return { success: false, error: "Failed to reorder packages." };
  }
}

// ─── Reorder Channels ─────────────────────────────────────────

interface ReorderChannelsInput {
  packageId: string;
  orderedIds: string[];
  actor: Actor;
}

export async function reorderChannelsAction(
  input: ReorderChannelsInput
): Promise<ActionResult> {
  const { packageId, orderedIds, actor } = input;

  if (!authorizeWrite(actor.role)) {
    return { success: false, error: "You do not have permission to reorder channels." };
  }

  try {
    const batch = adminDb.batch();
    orderedIds.forEach((id, index) => {
      batch.update(
        adminDb.collection("packages").doc(packageId).collection("channels").doc(id),
        {
          displayOrder: index,
          updatedAt: FieldValue.serverTimestamp(),
        }
      );
    });
    await batch.commit();

    return { success: true };
  } catch (err) {
    console.error("[reorderChannels]", err);
    return { success: false, error: "Failed to reorder channels." };
  }
}

// ─── Delete Package ────────────────────────────────────────────

interface DeletePackageInput {
  packageId: string;
  actor: Actor;
}

export async function deletePackageAction(
  input: DeletePackageInput
): Promise<ActionResult> {
  const { packageId, actor } = input;

  if (!authorizeWrite(actor.role)) {
    return { success: false, error: "You do not have permission to delete packages." };
  }

  try {
    const channelsSnap = await adminDb
      .collection("packages")
      .doc(packageId)
      .collection("channels")
      .get();

    const batch = adminDb.batch();
    channelsSnap.docs.forEach((d) => batch.delete(d.ref));
    batch.delete(adminDb.collection("packages").doc(packageId));
    await batch.commit();

    await createAuditLog({
      actorUid: actor.uid,
      actorEmail: actor.email,
      action: "delete",
      resourceType: "package",
      resourceId: packageId,
      description: "Deleted a package and its channels.",
    });

    return { success: true };
  } catch (err) {
    console.error("[deletePackage]", err);
    return { success: false, error: "Failed to delete package." };
  }
}

// ─── Read Packages (server-side fallback for Vercel) ─────────

interface PackageItem {
  id: string;
  name: string;
  description?: string;
  imageUrl: string;
  category: string;
  isActive: boolean;
  displayOrder: number;
  channelCount: number;
  licenseNotes?: string;
}

export async function getPackagesAction(): Promise<PackageItem[]> {
  try {
    const docs = await getDocuments("packages");
    return docs.map((doc: { id: string; data: Record<string, unknown> }) => {
      const d = doc.data;
      return {
        id: doc.id,
        name: (d.name as string) ?? doc.id,
        description: d.description as string | undefined,
        imageUrl: (d.imageUrl as string) ?? "",
        category: (d.category as string) ?? "",
        isActive: (d.isActive as boolean) ?? true,
        displayOrder: (d.displayOrder as number) ?? 0,
        channelCount: (d.channelCount as number) ?? 0,
        licenseNotes: d.licenseNotes as string | undefined,
      };
    });
  } catch (err) {
    console.error("[getPackagesAction]", err);
    return [];
  }
}

interface ChannelItem {
  id: string;
  name: string;
  logoUrl?: string;
  streamUrl: string;
  streamUrls?: string[];
  quality: string;
  isActive: boolean;
  displayOrder: number;
}

export async function getChannelsAction(
  packageId: string
): Promise<ChannelItem[]> {
  try {
    const docs = await getDocuments("packages", {
      subcollection: "channels",
      parentId: packageId,
    });
    return docs.map((d: { id: string; data: Record<string, unknown> }) => {
      const data = d.data;
      return {
        id: d.id,
        name: (data.name as string) ?? "",
        logoUrl: data.logoUrl as string | undefined,
        streamUrl: (data.streamUrl as string) ?? "",
        streamUrls: data.streamUrls as string[] | undefined,
        quality: (data.quality as string) ?? "auto",
        isActive: (data.isActive as boolean) ?? true,
        displayOrder: (data.displayOrder as number) ?? 0,
      };
    });
  } catch (err) {
    console.error("[getChannelsAction]", err);
    return [];
  }
}
