const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!;
const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY!;

const BASE = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;

function mapValue(v: unknown): Record<string, unknown> {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === "string") return { stringValue: v };
  if (typeof v === "number") return { integerValue: String(Math.floor(v)) };
  if (typeof v === "boolean") return { booleanValue: v };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(mapValue) } };
  if (typeof v === "object") {
    const fields: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      fields[k] = mapValue(val);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(v) };
}

function decodeValue(v: Record<string, unknown>): unknown {
  if ("nullValue" in v) return null;
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("timestampValue" in v) {
    const ms = new Date(v.timestampValue as string).getTime();
    return { seconds: Math.floor(ms / 1000), nanoseconds: (ms % 1000) * 1000000 };
  }
  if ("arrayValue" in v) {
    const arr = (v.arrayValue as Record<string, unknown>).values;
    if (!Array.isArray(arr)) return [];
    return arr.map((item) => decodeValue(item as Record<string, unknown>));
  }
  if ("mapValue" in v) {
    const fields = (v.mapValue as Record<string, unknown>).fields;
    if (!fields) return {};
    return decodeFields(fields as Record<string, Record<string, unknown>>);
  }
  return v;
}

function decodeFields(fields: Record<string, Record<string, unknown>> | undefined): Record<string, unknown> {
  if (!fields) return {};
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    result[key] = decodeValue(value);
  }
  return result;
}

function encodeDocument(data: Record<string, unknown>) {
  const fields: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    fields[key] = mapValue(value);
  }
  return { fields };
}

async function getToken(): Promise<string | null> {
  const key = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const email = process.env.FIREBASE_CLIENT_EMAIL;
  if (!key || !email) return null;
  const { JWT } = await import("google-auth-library");
  const client = new JWT({
    email,
    key,
    scopes: ["https://www.googleapis.com/auth/datastore"],
  });
  const res = await client.getAccessToken();
  return res?.token ?? null;
}

export async function restRead(url: string) {
  const separator = url.includes("?") ? "&" : "?";
  const res = await fetch(`${BASE}/${url}${separator}key=${apiKey}`);
  if (res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("[REST] read error", res.status, text.slice(0, 200));
    return null;
  }
  return res.json();
}

export async function restWrite(method: "POST" | "PATCH" | "DELETE", url: string, body?: Record<string, unknown>) {
  const token = await getToken();
  if (!token) {
    console.error("[REST] no token");
    return null;
  }
  const res = await fetch(`${BASE}/${url}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(encodeDocument(body)) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("[REST] write error", res.status, text.slice(0, 300));
    return null;
  }
  return res.json();
}

export async function getDocuments(collection: string, options?: {
  subcollection?: string;
  parentId?: string;
  orderByField?: string;
  orderByDir?: "asc" | "desc";
  limitCount?: number;
}) {
  let path: string;
  if (options?.subcollection && options?.parentId) {
    path = `${collection}/${options.parentId}/${options.subcollection}`;
  } else {
    path = collection;
  }

  let url = path;
  const params: string[] = [];

  if (options?.orderByField) {
    const dir = options.orderByDir === "desc" ? "desc" : "asc";
    params.push(`orderBy=${encodeURIComponent(`${options.orderByField} ${dir}`)}`);
  }
  if (options?.limitCount) {
    params.push(`pageSize=${options.limitCount}`);
  }

  if (params.length > 0) url += `?${params.join("&")}`;

  const json = await restRead(url);
  if (!json || !json.documents) return [];

  return json.documents.map((d: { name: string; fields: Record<string, Record<string, unknown>>; createTime?: string; updateTime?: string }) => ({
    id: d.name.split("/").pop() ?? "",
    data: decodeFields(d.fields),
  }));
}

export async function getDocument(collection: string, docId: string) {
  const json = await restRead(`${collection}/${docId}`);
  if (!json) return null;
  return {
    id: docId,
    data: decodeFields(json.fields),
  };
}

export async function addDocument(collection: string, data: Record<string, unknown>) {
  const json = await restWrite("POST", collection, data);
  if (!json) return null;
  return json.name?.split("/").pop() ?? null;
}

export async function updateDocument(collection: string, docId: string, data: Record<string, unknown>) {
  const json = await restWrite("PATCH", `${collection}/${docId}`, data);
  return json !== null;
}
