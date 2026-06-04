import { initializeApp, getApps } from "firebase/app";
import {
  getAuth,
  connectAuthEmulator,
  browserLocalPersistence,
  setPersistence,
} from "firebase/auth";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getStorage, connectStorageEmulator } from "firebase/storage";
import {
  getRemoteConfig,
  type RemoteConfig,
} from "firebase/remote-config";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
} as const;

export const firebaseApp =
  getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);
export const storage = getStorage(firebaseApp);
export const remoteConfig = getRemoteConfig(firebaseApp);

setPersistence(auth, browserLocalPersistence).catch(() => {
  // Silently handle — background / server-side contexts may not support IndexedDB.
});

const isDev =
  process.env.NODE_ENV === "development" &&
  process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true";

if (isDev) {
  try {
    connectAuthEmulator(auth, "http://localhost:9099", { disableWarnings: true });
    connectFirestoreEmulator(db, "localhost", 8080);
    connectStorageEmulator(storage, "localhost", 9199);
  } catch {
    // Emulator may already be connected during hot reload.
  }
}

export function initializeRemoteConfigDefaults(
  overrides?: Record<string, string | number | boolean>
): void {
  const rtc: RemoteConfig = remoteConfig;

  rtc.settings = {
    minimumFetchIntervalMillis: isDev ? 0 : 300_000,
    fetchTimeoutMillis: 10_000,
  };

  rtc.defaultConfig = {
    enableSportPackages: (overrides?.enableSportPackages ?? "true") as string,
    enableMoviesSeries: (overrides?.enableMoviesSeries ?? "true") as string,
    enableLiveWatchButton: (overrides?.enableLiveWatchButton ?? "true") as string,
    enableAdMob: (overrides?.enableAdMob ?? "false") as string,
    enableAppOpenAds: (overrides?.enableAppOpenAds ?? "false") as string,
    enableInterstitialAds: (overrides?.enableInterstitialAds ?? "false") as string,
    enableNews: (overrides?.enableNews ?? "true") as string,
    enablePushNotifications: (overrides?.enablePushNotifications ?? "true") as string,
    maintenanceMode: (overrides?.maintenanceMode ?? "false") as string,
    forceUpdateEnabled: (overrides?.forceUpdateEnabled ?? "false") as string,
    minimumSupportedVersion: (overrides?.minimumSupportedVersion ?? "1.0.0") as string,
  };
}

if (isDev) {
  initializeRemoteConfigDefaults();
}
