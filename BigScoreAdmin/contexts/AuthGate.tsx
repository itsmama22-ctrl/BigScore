"use client";

import dynamic from "next/dynamic";
import { type ReactNode } from "react";

const AuthProvider = dynamic(
  () =>
    import("@/contexts/AuthContext").then((mod) => ({
      default: mod.AuthProvider,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-screen items-center justify-center bg-bg-primary">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-pulse rounded-full bg-bg-tertiary" />
          <p className="text-body text-text-tertiary">Loading...</p>
        </div>
      </div>
    ),
  }
);

export function AuthGate({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
