"use server";

export async function getAdminProfileAction(
  uid: string
): Promise<{
  uid: string;
  email: string;
  displayName: string | null;
  role: string;
  status: string;
} | null> {
  try {
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
    if (!projectId || !apiKey) {
      console.error("[A] Missing env vars");
      return null;
    }

    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/adminUsers/${uid}?key=${apiKey}`;

    const res = await fetch(url);

    if (!res.ok) {
      if (res.status === 404) return null;
      console.error("[A] HTTP", res.status);
      return null;
    }

    const data = await res.json();
    const fields = data.fields || {};

    const role = fields.role?.stringValue;
    const status = fields.status?.stringValue;

    if (status !== "active") return null;
    if (!role) return null;

    return {
      uid: fields.uid?.stringValue || uid,
      email: fields.email?.stringValue || "",
      displayName: fields.displayName?.stringValue || null,
      role,
      status,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[getAdminProfileAction]", msg);
    return null;
  }
}
