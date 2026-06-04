"use server";

import { createAuditLog } from "@/lib/audit/createAuditLog";

const GITHUB_TOKEN = process.env.GITHUB_IMAGE_UPLOAD_TOKEN;
const GITHUB_OWNER = process.env.GITHUB_IMAGE_REPO_OWNER || "itsmama22-ctrl";
const GITHUB_REPO = process.env.GITHUB_IMAGE_REPO_NAME || "BigScore";
const GITHUB_BRANCH = process.env.GITHUB_IMAGE_BRANCH || "main";
const GITHUB_BASE_PATH = process.env.GITHUB_IMAGE_BASE_PATH || "public/images/packages";

interface Actor {
  uid: string;
  email: string;
  role: string;
}

function isGitHubConfigured(): boolean {
  return !!GITHUB_TOKEN && GITHUB_TOKEN.trim().length > 0;
}

export async function uploadImageToGitHubAction(input: {
  base64Content: string;
  fileName: string;
  folder?: string;
  actor: Actor;
}): Promise<{
  success: boolean;
  url?: string;
  error?: string;
}> {
  if (!isGitHubConfigured()) {
    return {
      success: false,
      error: "GitHub upload not configured. Missing GITHUB_IMAGE_UPLOAD_TOKEN.",
    };
  }

  const { base64Content, fileName, folder, actor } = input;

  if (actor.role !== "super_admin") {
    return {
      success: false,
      error: "Only super admins can upload images.",
    };
  }

  try {
    const base64Data = base64Content.includes(",")
      ? base64Content.split(",")[1]
      : base64Content;

    const ext = fileName.split(".").pop() || "jpg";
    const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`;

    const basePath = folder
      ? `${GITHUB_BASE_PATH}/${folder}`.replace(/\/+/g, "/")
      : GITHUB_BASE_PATH;
    const path = `${basePath}/${uniqueName}`.replace(/^\/+/, "");

    const apiUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${path}`;

    const response = await fetch(apiUrl, {
      method: "PUT",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({
        message: `chore: upload image ${uniqueName} [skip ci]`,
        content: base64Data,
        branch: GITHUB_BRANCH,
      }),
    });

    const data = (await response.json()) as Record<string, unknown>;

    if (!response.ok) {
      console.error("[GitHub Upload] API error:", data);
      return {
        success: false,
        error: `GitHub API error: ${(data as { message?: string }).message || response.statusText}`,
      };
    }

    const rawUrl = `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${GITHUB_BRANCH}/${path}`;

    await createAuditLog({
      actorUid: actor.uid,
      actorEmail: actor.email,
      action: "update",
      resourceType: "image",
      resourceId: path,
      description: `Uploaded image to GitHub: ${path}`,
      metadata: { url: rawUrl, folder: folder || "packages" },
    });

    return {
      success: true,
      url: rawUrl,
    };
  } catch (err) {
    console.error("[GitHub Upload] Unexpected error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Upload failed.",
    };
  }
}

export async function isGitHubUploadEnabledAction(): Promise<boolean> {
  return isGitHubConfigured();
}
