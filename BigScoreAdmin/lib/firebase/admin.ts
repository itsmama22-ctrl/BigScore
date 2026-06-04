import "server-only";

import { getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getStorage, type Storage } from "firebase-admin/storage";
import { JWT } from "google-auth-library";

let cachedApp: App | null = null;

function getApp(): App | null {
  if (cachedApp) return cachedApp;

  const existing = getApps();
  if (existing.length > 0) {
    cachedApp = existing[0];
    return cachedApp;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) return null;

  try {
    const key = privateKey.replace(/\\n/g, "\n");
    const jwtClient = new JWT({
      email: clientEmail,
      key,
      scopes: [
        "https://www.googleapis.com/auth/cloud-platform",
        "https://www.googleapis.com/auth/datastore",
        "https://www.googleapis.com/auth/firebase.messaging",
        "https://www.googleapis.com/auth/cloudstorage",
      ],
    });

    cachedApp = initializeApp({
      credential: {
        getAccessToken: async () => {
          const res = await jwtClient.getAccessToken();
          return {
            access_token: res?.token ?? "",
            expires_in: 3600,
          };
        },
      },
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    });

    return cachedApp;
  } catch (err) {
    console.error("[Firebase Admin] Init failed:", err);
    return null;
  }
}

function createAuth(): Auth {
  const app = getApp();
  if (!app) throw new Error("[Firebase Admin] Cannot initialize Auth: missing credentials.");
  return getAuth(app);
}

function createDb(): Firestore {
  const app = getApp();
  if (!app) throw new Error("[Firebase Admin] Cannot initialize Firestore: missing credentials.");
  return getFirestore(app);
}

function createStorage(): Storage {
  const app = getApp();
  if (!app) throw new Error("[Firebase Admin] Cannot initialize Storage: missing credentials.");
  return getStorage(app);
}

/**
 * Lazy singleton instances.
 * These are initialized on first use, not at import time.
 * During Next.js build/SSR without credentials, they remain null
 * without throwing. At runtime with valid credentials, they
 * initialize normally.
 */
let _auth: Auth | null = null;
let _db: Firestore | null = null;
let _storage: Storage | null = null;

export const adminAuth: Auth = new Proxy({} as Auth, {
  get(_, prop) {
    if (!_auth) _auth = createAuth();
    const target = _auth as unknown as Record<string | symbol, unknown>;
    const value = target[prop];
    if (typeof value === "function") {
      return (value as (...args: unknown[]) => unknown).bind(target);
    }
    return value;
  },
});

export const adminDb: Firestore = new Proxy({} as Firestore, {
  get(_, prop) {
    if (!_db) _db = createDb();
    const target = _db as unknown as Record<string | symbol, unknown>;
    const value = target[prop];
    if (typeof value === "function") {
      return (value as (...args: unknown[]) => unknown).bind(target);
    }
    return value;
  },
});

export const adminStorage: Storage = new Proxy({} as Storage, {
  get(_, prop) {
    if (!_storage) _storage = createStorage();
    const target = _storage as unknown as Record<string | symbol, unknown>;
    const value = target[prop];
    if (typeof value === "function") {
      return (value as (...args: unknown[]) => unknown).bind(target);
    }
    return value;
  },
});
