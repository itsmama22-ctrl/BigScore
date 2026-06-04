import { JWT } from "google-auth-library";

let cachedToken: { token: string; expiresAt: number } | null = null;
let client: JWT | null = null;

function getClient(): JWT | null {
  if (client) return client;
  const key = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const email = process.env.FIREBASE_CLIENT_EMAIL;
  if (!key || !email) return null;
  client = new JWT({
    email,
    key,
    scopes: [
      "https://www.googleapis.com/auth/datastore",
      "https://www.googleapis.com/auth/firebase.messaging",
    ],
  });
  return client;
}

export async function getAccessToken(): Promise<string | null> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now) return cachedToken.token;

  const c = getClient();
  if (!c) return null;

  try {
    const res = await c.getAccessToken();
    const token = res?.token;
    if (!token) return null;
    cachedToken = { token, expiresAt: now + 3600_000 };
    return token;
  } catch (err) {
    console.error("[getAccessToken]", err);
    return null;
  }
}

export async function firestoreWrite(
  collection: string,
  docId: string | undefined,
  data: Record<string, unknown>
): Promise<string | null> {
  const token = await getAccessToken();
  if (!token) return null;

  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) return null;

  const base = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collection}`;
  const url = docId ? `${base}/${docId}` : base;

  const res = await fetch(url, {
    method: docId ? "PATCH" : "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fields: toFields(data) }),
  });

  if (!res.ok) {
    console.error("[firestoreWrite]", res.status, await res.text().catch(() => ""));
    return null;
  }

  const json = await res.json();
  return json.name?.split("/").pop() ?? docId ?? null;
}

// ─── Helpers ─────────────────────────────────────────────────

function toFields(data: Record<string, unknown>): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    fields[key] = toValue(value);
  }
  return fields;
}

function toValue(v: unknown): Record<string, unknown> {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === "string") return { stringValue: v };
  if (typeof v === "number") return { integerValue: String(Math.floor(v)) };
  if (typeof v === "boolean") return { booleanValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toValue) } };
  if (typeof v === "object") {
    return { mapValue: { fields: toFields(v as Record<string, unknown>) } };
  }
  return { stringValue: String(v) };
}
