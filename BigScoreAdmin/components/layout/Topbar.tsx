"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import {
  Menu,
  ChevronDown,
  User,
  LogOut,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";

interface TopbarProps {
  onMenuToggle: () => void;
}

const breadcrumbLabels: Record<string, string> = {
  dashboard: "Dashboard",
  matches: "All Matches",
  live: "Live Matches",
  competitions: "Competitions",
  teams: "Teams",
  news: "News",
  packages: "Sport Packages",
  channels: "Channels",
  movies: "Movies & Series",
  notifications: "Notifications",
  analytics: "Analytics",
  users: "Users",
  config: "App Config",
  "audit-logs": "Audit Logs",
  new: "Create",
  edit: "Edit",
};

const roleBadgeVariant: Record<string, "gold" | "blue" | "green" | "purple"> =
  {
    super_admin: "gold",
    content_manager: "blue",
    moderator: "green",
    viewer: "purple",
  };

function getBreadcrumbs(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);
  let accumulated = "";

  return segments.map((segment, index) => {
    accumulated += "/" + segment;
    const isLast = index === segments.length - 1;
    const label =
      breadcrumbLabels[segment] ||
      segment.charAt(0).toUpperCase() + segment.slice(1);

    return {
      label,
      href: accumulated,
      current: isLast,
    };
  });
}

export function Topbar({ onMenuToggle }: TopbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, adminProfile, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
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
  const breadcrumbs = getBreadcrumbs(pathname);

  return (
    <header className="fixed inset-x-0 top-0 z-40 flex h-16 items-center justify-between border-b border-border-default bg-bg-primary px-4 md:px-6">
      {/* Left section */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuToggle}
          className="rounded-lg p-2 text-text-secondary transition-colors hover:bg-bg-tertiary lg:hidden"
          aria-label="Toggle sidebar"
        >
          <Menu className="h-5 w-5" />
        </button>

        <nav
          aria-label="Breadcrumbs"
          className="hidden items-center gap-1 md:flex"
        >
          {breadcrumbs.map((crumb, index) => (
            <span key={crumb.href} className="flex items-center gap-1">
              {index > 0 && (
                <span className="text-text-disabled">/</span>
              )}
              {crumb.current ? (
                <span className="text-body-sm text-text-primary">
                  {crumb.label}
                </span>
              ) : (
                <button
                  onClick={() => router.push(crumb.href)}
                  className="text-body-sm text-text-tertiary transition-colors hover:text-text-secondary"
                >
                  {crumb.label}
                </button>
              )}
            </span>
          ))}
        </nav>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-3">
        {/* Search */}
        <div
          className={cn(
            "hidden items-center rounded-lg border transition-colors duration-200 md:flex",
            searchFocused
              ? "border-border-focus bg-bg-tertiary"
              : "border-border-default bg-transparent"
          )}
        >
          <Search className="ml-3 h-4 w-4 text-text-tertiary" />
          <input
            type="search"
            placeholder="Search..."
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            className="w-40 bg-transparent px-3 py-2 text-body-sm text-text-primary placeholder:text-text-disabled focus:outline-none lg:w-56"
          />
        </div>

        {/* User menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((prev) => !prev)}
            className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-bg-tertiary"
          >
            <div className="hidden items-center gap-2 md:flex">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-bg-elevated">
                <User className="h-5 w-5 text-text-secondary" />
              </div>
              <div className="hidden flex-col items-start lg:flex">
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
              <div className="border-b border-border-muted px-3 py-2 lg:hidden">
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
      </div>
    </header>
  );
}
