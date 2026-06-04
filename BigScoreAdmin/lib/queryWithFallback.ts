import {
  collection,
  query,
  orderBy as clientOrderBy,
  getDocs,
  limit,
  where,
  doc,
  getDoc,
  type QueryConstraint,
  type WhereFilterOp,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { runQueryAction } from "@/app/actions/runQuery";

interface FallbackFilter {
  field: string;
  op: WhereFilterOp;
  value: unknown;
}

interface FallbackOptions {
  collection: string;
  docId?: string;
  subcollection?: string;
  parentId?: string;
  orderByField?: string;
  orderByDir?: "asc" | "desc";
  limitCount?: number;
  filters?: FallbackFilter[];
}

export async function queryWithFallback<T>(
  options: FallbackOptions,
  timeoutMs = 4000
): Promise<T[]> {
  try {
    const result = await Promise.race([
      clientSideQuery<T>(options),
      new Promise<null>((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), timeoutMs)
      ),
    ]);
    if (result) return result;
  } catch {
    // fall through to server action
  }

  const serverResult = await runQueryAction(options);
  if (serverResult.error) {
    console.error("[qFallback] server error:", serverResult.error);
  }
  return serverResult.data as T[];
}

async function clientSideQuery<T>(options: FallbackOptions): Promise<T[]> {
  if (options.docId) {
    const snap = await getDoc(doc(db, options.collection, options.docId));
    if (!snap.exists()) return [];
    return [{ id: snap.id, ...snap.data() }] as T[];
  }

  const constraints: QueryConstraint[] = [];

  if (options.filters) {
    for (const f of options.filters) {
      constraints.push(where(f.field, f.op, f.value));
    }
  }

  if (options.orderByField) {
    constraints.push(clientOrderBy(options.orderByField, options.orderByDir ?? "asc"));
  }

  if (options.limitCount) {
    constraints.push(limit(options.limitCount));
  }

  let ref;
  if (options.subcollection && options.parentId) {
    ref = collection(db, options.collection, options.parentId, options.subcollection);
  } else {
    ref = collection(db, options.collection);
  }

  const snap = await getDocs(query(ref, ...constraints));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })) as T[];
}
