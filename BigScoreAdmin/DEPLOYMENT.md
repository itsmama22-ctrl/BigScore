# =============================================================================
# BigScore Admin Panel — Deployment Checklist
# =============================================================================
# Follow these steps when deploying to Vercel for the first time
# or after major infrastructure changes.
# =============================================================================

## 1. Firebase Production Project
- [ ] Create or select a Firebase production project (not the emulator project).
- [ ] Enable Authentication (Email/Password provider).
- [ ] Enable Firestore Database in production mode.
- [ ] Enable Storage in production mode.
- [ ] Enable Remote Config (optional, fallback is Firestore appSettings).
- [ ] In Project Settings → Service Accounts, generate a new private key.
- [ ] Download the JSON key and extract: project_id, client_email, private_key.

## 2. Vercel Project Setup
- [ ] Import the Git repository into Vercel.
- [ ] Set Framework Preset to "Next.js".
- [ ] Root Directory: `/` (or the monorepo path).
- [ ] Build Command: `npm run build` (default).
- [ ] Output Directory: `.next` (default).
- [ ] Install Command: `npm install` (default).

## 3. Environment Variables (Vercel Dashboard → Settings → Environment Variables)
Copy from `.env.example` — configure ALL of these:
- [ ] NEXT_PUBLIC_FIREBASE_API_KEY
- [ ] NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
- [ ] NEXT_PUBLIC_FIREBASE_PROJECT_ID
- [ ] NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
- [ ] NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
- [ ] NEXT_PUBLIC_FIREBASE_APP_ID
- [ ] FIREBASE_PROJECT_ID
- [ ] FIREBASE_CLIENT_EMAIL
- [ ] FIREBASE_PRIVATE_KEY (paste the full key including `-----BEGIN PRIVATE KEY-----` and newlines)
- [ ] NEXT_PUBLIC_USE_FIREBASE_EMULATORS — set to `false` (or leave unset)

## 4. Disable Emulator Mode
- [ ] Ensure NEXT_PUBLIC_USE_FIREBASE_EMULATORS is `false` or not set in Vercel env vars.
- [ ] Verify the `NODE_ENV === "development"` guard in `lib/firebase/client.ts`.

## 5. Firestore Security Rules
- [ ] Deploy `firestore.rules` via Firebase CLI: `firebase deploy --only firestore:rules`
- [ ] Or deploy via Firebase Console → Firestore → Rules.
- [ ] Verify: attempt a direct client write to `adminUsers` — should be denied.
- [ ] Verify: authenticated read on `matches` — should be allowed.

## 6. Storage Security Rules
- [ ] Deploy `storage.rules` via Firebase CLI: `firebase deploy --only storage:rules`
- [ ] Or deploy via Firebase Console → Storage → Rules.
- [ ] Verify: image upload as authenticated user works.
- [ ] Verify: public read access works (direct URL without auth).

## 7. Vercel Deployment
- [ ] Push to main branch (or trigger manual deploy).
- [ ] Wait for build to complete.
- [ ] Check build logs — no TypeScript errors, all env vars resolved.
- [ ] Verify the deployment URL is active.

## 8. Post-Deployment Verification
### HTTPS
- [ ] Navigate to the deployment URL — must load over HTTPS.
- [ ] Check browser for mixed-content warnings (all Firebase Storage URLs should be HTTPS).

### Authentication
- [ ] Visit `/login` — login form renders.
- [ ] Log in with a valid admin email/password.
- [ ] Verify redirect to `/dashboard`.
- [ ] Refresh the page — stay logged in (session cookie persists).

### Protected Routes
- [ ] Log out, then attempt to visit `/matches` → redirected to `/login?redirect=/matches`.
- [ ] Log in as a viewer, then attempt to visit `/config` → redirected to `/unauthorized`.
- [ ] Verify middleware works for all protected routes.

### Server Actions
- [ ] Create a match via `/matches/new` — verify it appears in the list.
- [ ] Edit a match — verify changes persist.
- [ ] Delete a match — verify it disappears.
- [ ] Check Firestore `auditLogs` collection — an entry should exist for each action.
- [ ] Verify audit log entries contain: actorUid, actorEmail, action, resourceType, resourceId, description, createdAt.

### Firebase Admin SDK
- [ ] Verify server actions use Firebase Admin SDK (not client SDK) for writes.
- [ ] Verify admin SDK credentials are NOT exposed in client-side bundles (check browser DevTools → Sources).

## 9. Create First Admin User
- [ ] In Firebase Console → Authentication, create a user with email/password.
- [ ] Copy the user's UID.
- [ ] In Firestore, create a document at `adminUsers/{UID}`:
  ```json
  {
    "uid": "<UID>",
    "email": "<email>",
    "displayName": "Super Admin",
    "role": "super_admin",
    "status": "active",
    "createdAt": "<server timestamp>",
    "updatedAt": "<server timestamp>"
  }
  ```
- [ ] Log in with this user — verify full access to `/config`, `/users`, etc.

## 10. Domain & SSL (Optional)
- [ ] In Vercel → Domains, add your custom domain.
- [ ] Update DNS records as instructed.
- [ ] Verify SSL certificate is provisioned automatically.
- [ ] Update Firebase Authentication → Authorized Domains to include the custom domain.
