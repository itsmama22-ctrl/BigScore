"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

export default function UnauthorizedPage() {
  const router = useRouter();
  const { user, adminProfile, loading, signOut } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  const isDisabled = adminProfile?.status === "disabled";
  const isNoRole = user && !adminProfile && !loading;

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-primary p-4">
      <div className="flex w-full max-w-[440px] flex-col items-center gap-6 rounded-xl border border-border-default bg-bg-secondary p-12 text-center shadow-xl">
        <div className="rounded-full bg-accent-red/15 p-4">
          <ShieldAlert className="h-10 w-10 text-accent-red" />
        </div>

        <div className="flex flex-col gap-2">
          <h1 className="text-h2 text-text-primary">Access Denied</h1>

          {isDisabled && (
            <p className="text-body text-text-tertiary">
              Your admin account has been <span className="text-accent-red">disabled</span>.
              <br />
              Please contact a super admin to restore access.
            </p>
          )}

          {isNoRole && (
            <p className="text-body text-text-tertiary">
              Your account is not registered as an admin user.
              <br />
              Please contact a super admin to grant you access.
            </p>
          )}

          {!isDisabled && !isNoRole && (
            <p className="text-body text-text-tertiary">
              You do not have permission to access this page.
              <br />
              Your current role does not grant access to this resource.
            </p>
          )}
        </div>

        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => router.push("/dashboard")}
          >
            Go to Dashboard
          </Button>
          <Button variant="ghost" onClick={signOut}>
            Sign Out
          </Button>
        </div>
      </div>
    </div>
  );
}
