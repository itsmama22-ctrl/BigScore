"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { isRouteAuthorized } from "@/lib/auth/permissions";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, role, loading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
      return;
    }

    if (!loading && user && role && !isRouteAuthorized(pathname, role)) {
      router.replace("/unauthorized");
    }
  }, [loading, user, role, pathname, router]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg-primary">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-pulse rounded-full bg-bg-tertiary" />
          <p className="text-body text-text-tertiary">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-primary">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <Topbar onMenuToggle={() => setSidebarOpen((prev) => !prev)} />

      <main className="pt-16 transition-all duration-0 lg:pl-[280px]">
        <div className="p-4 md:p-6">{children}</div>
      </main>
    </div>
  );
}
