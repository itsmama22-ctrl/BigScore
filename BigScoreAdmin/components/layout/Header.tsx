"use client";

import { useRouter } from "next/navigation";
import { Trophy, LogOut, User, ChevronDown } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const roleBadgeVariant: Record<string, "gold" | "blue" | "green" | "purple"> = {
  super_admin: "gold",
  content_manager: "blue",
  moderator: "green",
  viewer: "purple",
};

export function Header() {
  const router = useRouter();
  const { user, adminProfile, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!user || !adminProfile) return null;

  const variant = roleBadgeVariant[adminProfile.role] || "purple";

  return (
    <header className="fixed inset-x-0 top-0 z-40 flex h-16 items-center justify-between border-b border-border-default bg-bg-primary px-4 md:px-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push("/dashboard")}
          className="flex items-center gap-2 transition-opacity hover:opacity-80"
        >
          <Trophy className="h-6 w-6 text-accent-gold" />
          <span className="text-h4 text-text-primary hidden md:inline">
            BigScore Admin
          </span>
        </button>
      </div>

      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setMenuOpen((prev) => !prev)}
          className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-bg-tertiary"
        >
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-bg-elevated">
              <User className="h-5 w-5 text-text-secondary" />
            </div>
            <div className="hidden flex-col items-start md:flex">
              <span className="text-body-sm text-text-primary">
                {adminProfile.displayName || adminProfile.email}
              </span>
              <Badge variant={variant} className="capitalize">
                {adminProfile.role.replace("_", " ")}
              </Badge>
            </div>
          </div>
          <ChevronDown
            className={cn(
              "h-4 w-4 text-text-tertiary transition-transform duration-150",
              menuOpen && "rotate-180"
            )}
          />
        </button>

        {menuOpen && (
          <div className="absolute right-0 top-full mt-2 w-48 rounded-lg border border-border-default bg-bg-secondary p-1.5 shadow-lg">
            <div className="border-b border-border-muted px-3 py-2 md:hidden">
              <p className="text-body-sm text-text-primary">
                {adminProfile.displayName || adminProfile.email}
              </p>
              <Badge variant={variant} className="mt-1 capitalize">
                {adminProfile.role.replace("_", " ")}
              </Badge>
            </div>

            <button
              onClick={async () => {
                setMenuOpen(false);
                await signOut();
                router.replace("/login");
              }}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-body-sm text-text-secondary transition-colors hover:bg-bg-tertiary hover:text-text-primary"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
