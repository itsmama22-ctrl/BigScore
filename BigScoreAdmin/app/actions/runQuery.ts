"use server";

import { getDocuments, getDocument } from "@/lib/firestore-api";

interface WhereFilter {
  field: string;
  op: string;
  value: unknown;
}

interface QueryOptions {
  collection: string;
  docId?: string;
  subcollection?: string;
  parentId?: string;
  filters?: WhereFilter[];
  orderByField?: string;
  orderByDir?: "asc" | "desc";
  limitCount?: number;
}

export async function runQueryAction(
  options: QueryOptions
): Promise<{ data: Record<string, unknown>[]; error?: string }> {
  try {
    if (options.docId) {
      const doc = await getDocument(options.collection, options.docId);
      if (!doc) return { data: [] };
      return { data: [doc] };
    }

    // REST API doesn't support client-side filters in query params easily,
    // so fetch all and filter client-side
    const docs = await getDocuments(options.collection, {
      subcollection: options.subcollection,
      parentId: options.parentId,
      orderByField: options.orderByField,
      orderByDir: options.orderByDir,
      limitCount: options.limitCount,
    });

    let result = docs;

    if (options.filters && options.filters.length > 0) {
      result = docs.filter((doc: { id: string; data: Record<string, unknown> }) => {
        return (options.filters ?? []).every((f: WhereFilter) => {
          const val = (doc.data as Record<string, unknown>)[f.field];
          switch (f.op) {
            case "==":
              return val === f.value;
            case "!=":
              return val !== f.value;
            case "in":
              return Array.isArray(f.value) && (f.value as unknown[]).includes(val);
            case "not-in":
              return Array.isArray(f.value) && !(f.value as unknown[]).includes(val);
            case ">":
              return val != null && (val as number) > (f.value as number);
            case ">=":
              return val != null && (val as number) >= (f.value as number);
            case "<":
              return val != null && (val as number) < (f.value as number);
            case "<=":
              return val != null && (val as number) <= (f.value as number);
            case "array-contains":
              return Array.isArray(val) && (val as unknown[]).includes(f.value);
            case "array-contains-any":
              return Array.isArray(f.value) && Array.isArray(val) && (f.value as unknown[]).some((v: unknown) => (val as unknown[]).includes(v));
            default:
              return true;
          }
        });
      });
    }

    return { data: result };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[runQuery]", msg);
    return { data: [], error: msg };
  }
}
