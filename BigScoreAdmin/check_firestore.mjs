import { cert, initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";

const envContent = fs.readFileSync(".env.local", "utf8");
const env = {};
envContent.split("\n").forEach((line) => {
  const m = line.match(/^([^=]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^"|"$/g, "");
});

console.log("Project ID:", env["FIREBASE_PROJECT_ID"]);
console.log("Client Email:", env["FIREBASE_CLIENT_EMAIL"]);
console.log("Key starts with:", env["FIREBASE_PRIVATE_KEY"].substring(0, 50));

const key = env["FIREBASE_PRIVATE_KEY"].replace(/\\n/g, "\n");

if (getApps().length === 0) {
  initializeApp({
    credential: cert({
      projectId: env["FIREBASE_PROJECT_ID"],
      clientEmail: env["FIREBASE_CLIENT_EMAIL"],
      privateKey: key,
    }),
  });
}

const db = getFirestore();

const snap = await db.collection("matches").limit(3).get();
console.log("Matches count:", snap.size);

const compSnap = await db.collection("competitions").limit(3).get();
console.log("Competitions count:", compSnap.size);

const teamSnap = await db.collection("teams").limit(3).get();
console.log("Teams count:", teamSnap.size);

const pkgSnap = await db.collection("packages").limit(3).get();
console.log("Packages count:", pkgSnap.size);

const userSnap = await db.collection("adminUsers").limit(3).get();
console.log("Admin users count:", userSnap.size);
