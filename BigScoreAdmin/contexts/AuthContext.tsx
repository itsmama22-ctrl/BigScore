"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import {
  onAuthStateChanged,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase/client";
import type { AdminRole } from "@/lib/auth/permissions";
import { getAdminProfileAction } from "@/app/actions/auth";

interface AdminProfile {
  uid: string;
  email: string;
  displayName: string | null;
  role: AdminRole;
  status: "active" | "disabled";
}

interface AuthContextValue {
  user: User | null;
  adminProfile: AdminProfile | null;
  role: AdminRole | null;
  loading: boolean;
  error: string | null;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function setSessionCookie(token: string | null) {
  if (token) {
    document.cookie = `__session=${token}; path=/; max-age=3600; SameSite=Lax`;
  } else {
    document.cookie = "__session=; path=/; max-age=0; SameSite=Lax";
  }
}

async function fetchAdminProfile(user: User): Promise<AdminProfile | null> {
  try {
    const docRef = doc(db, "adminUsers", user.uid);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) return null;

    const data = docSnap.data();

    if (data.status !== "active") return null;

    return {
      uid: user.uid,
      email: user.email || data.email || "",
      displayName: user.displayName || data.displayName || null,
      role: data.role as AdminRole,
      status: data.status as "active" | "disabled",
    };
  } catch (err) {
    console.error("[AuthContext] Failed to fetch admin profile:", err);
    return null;
  }
}

const CLIENT_SDK_TIMEOUT_MS = 3000;

async function fetchAdminProfileWithFallback(
  user: User
): Promise<AdminProfile | null> {
  try {
    const profile = await Promise.race([
      fetchAdminProfile(user),
      new Promise<"__timeout__">((resolve) =>
        setTimeout(() => resolve("__timeout__"), CLIENT_SDK_TIMEOUT_MS)
      ),
    ]);

    if (profile !== "__timeout__" && profile !== null) {
      return profile;
    }
  } catch {
    // Client SDK threw
  }

  try {
    const serverProfile = await getAdminProfileAction(user.uid);
    if (!serverProfile) return null;
    return {
      uid: serverProfile.uid,
      email: serverProfile.email,
      displayName: serverProfile.displayName,
      role: serverProfile.role as AdminRole,
      status: serverProfile.status as "active" | "disabled",
    };
  } catch (err) {
    console.error("[AuthContext] Fallback fetch also failed:", err);
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [adminProfile, setAdminProfile] = useState<AdminProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      if (currentUser) {
        const profile = await fetchAdminProfileWithFallback(currentUser);
        setAdminProfile(profile);

        if (!profile) {
          setError(
            "Your account does not have admin access. Please contact a super admin."
          );
        } else {
          setError(null);
        }

        const token = await currentUser.getIdToken();
        setSessionCookie(token);
      } else {
        setAdminProfile(null);
        setError(null);
        setSessionCookie(null);
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleSignOut = useCallback(async () => {
    try {
      await firebaseSignOut(auth);
      setSessionCookie(null);
    } catch (err) {
      console.error("[AuthContext] Sign out failed:", err);
    }
  }, []);

  const value: AuthContextValue = {
    user,
    adminProfile,
    role: adminProfile?.role ?? null,
    loading,
    error,
    signOut: handleSignOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuthContext must be used within an AuthProvider");
  }
  return context;
}
