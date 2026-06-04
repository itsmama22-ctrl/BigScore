export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
} as const;

export const firebaseCollections = {
  adminUsers: "adminUsers",
  matches: "matches",
  competitions: "competitions",
  teams: "teams",
  standings: "standings",
  news: "news",
  packages: "packages",
  channels: "channels",
  mediaContent: "mediaContent",
  appSettings: "appSettings",
  notifications: "notifications",
  auditLogs: "auditLogs",
  analyticsSummary: "analyticsSummary",
  deviceTokens: "deviceTokens",
} as const;
