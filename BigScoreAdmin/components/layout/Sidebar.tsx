"use client";

import { useEffect, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import {
  LayoutDashboard,
  Radio,
  Calendar,
  Trophy,
  Shield,
  Newspaper,
  Package,
  Settings,
  Bell,
  Users,
  BarChart3,
  History,
  X,
  User,
  PlugZap,
  RefreshCw,
} from "lucide-react";
import type { AdminRole } from "@/lib/auth/permissions";

interface NavItem {
  label: string;
  icon: React.ReactNode;
  route: string;
  permission?: AdminRole[];
}

const navSections: { label: string; items: NavItem[] }[] = [
  {
    label: "Main",
    items: [
      {
        label: "Dashboard",
        icon: <LayoutDashboard className="h-5 w-5" />,
        route: "/dashboard",
      },
      {
        label: "Live Matches",
        icon: <Radio className="h-5 w-5" />,
        route: "/matches/live",
      },
      {
        label: "All Matches",
        icon: <Calendar className="h-5 w-5" />,
        route: "/matches",
      },
    ],
  },
  {
    label: "Content",
    items: [
      {
        label: "Competitions",
        icon: <Trophy className="h-5 w-5" />,
        route: "/competitions",
      },
      {
        label: "Teams",
        icon: <Shield className="h-5 w-5" />,
        route: "/teams",
      },
      {
        label: "News",
        icon: <Newspaper className="h-5 w-5" />,
        route: "/news",
      },
      {
        label: "Sport Packages",
        icon: <Package className="h-5 w-5" />,
        route: "/packages",
      },
    ],
  },
  {
    label: "Management",
    items: [
      {
        label: "App Config",
        icon: <Settings className="h-5 w-5" />,
        route: "/config",
        permission: ["super_admin"],
      },
      {
        label: "Notifications",
        icon: <Bell className="h-5 w-5" />,
        route: "/notifications",
        permission: ["super_admin", "moderator"],
      },
      {
        label: "Users",
        icon: <Users className="h-5 w-5" />,
        route: "/users",
        permission: ["super_admin"],
      },
      {
        label: "Analytics",
        icon: <BarChart3 className="h-5 w-5" />,
        route: "/analytics",
      },
      {
        label: "Audit Logs",
        icon: <History className="h-5 w-5" />,
        route: "/audit-logs",
        permission: ["super_admin"],
      },
    ],
  },
   {
      label: "Sports Data API",
      items: [
        {
          label: "Live Match Settings",
          icon: <Radio className="h-5 w-5" />,
          route: "/config/live-matches",
          permission: ["super_admin"],
        },
        {
          label: "API Providers",
          icon: <PlugZap className="h-5 w-5" />,
          route: "/config/sports-api",
          permission: ["super_admin"],
        },
        {
          label: "Sync Management",
          icon: <RefreshCw className="h-5 w-5" />,
          route: "/config/sync-management",
          permission: ["super_admin"],
        },
      ],
    },
    {
      label: "News Data API",
      items: [
        {
          label: "News API Config",
          icon: <Newspaper className="h-5 w-5" />,
          route: "/config/news-api",
          permission: ["super_admin"],
        },
      ],
    },
  ];

const roleBadgeVariant: Record<string, "gold" | "blue" | "green" | "purple"> =
  {
    super_admin: "gold",
    content_manager: "blue",
    moderator: "green",
    viewer: "purple",
  };

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { adminProfile } = useAuth();

  const navigate = useCallback(
    (route: string) => {
      router.push(route);
      onClose();
    },
    [router, onClose]
  );

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (open) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  const role = adminProfile?.role;
  const variant = role ? roleBadgeVariant[role] : "purple";

  function isItemVisible(item: NavItem): boolean {
    if (!item.permission) return true;
    if (!role) return false;
    return item.permission.includes(role);
  }

  function isItemActive(route: string): boolean {
    if (route === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(route);
  }

  const sidebarContent = (
    <>
      <div className="flex h-16 shrink-0 items-center gap-3 border-b border-border-muted px-5">
        <Trophy className="h-6 w-6 text-accent-gold" />
        <span className="text-h4 text-text-primary">BigScore</span>
      </div>

      <div className="mx-3 mt-4 rounded-lg bg-bg-tertiary p-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-bg-elevated">
            <User className="h-5 w-5 text-text-secondary" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-body-sm text-text-primary">
              {adminProfile?.displayName || adminProfile?.email || "Admin"}
            </p>
            <Badge variant={variant} className="mt-0.5 capitalize">
              {role?.replace("_", " ") ?? "unknown"}
            </Badge>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {navSections.map((section) => {
          const visibleItems = section.items.filter(isItemVisible);
          if (visibleItems.length === 0) return null;

          return (
            <div key={section.label} className="mb-6">
              <p className="mb-2 px-3 text-caption font-medium uppercase tracking-wider text-text-disabled">
                {section.label}
              </p>
              <ul className="flex flex-col gap-0.5">
                {visibleItems.map((item) => {
                  const active = isItemActive(item.route);
                  return (
                    <li key={item.route}>
                      <button
                        onClick={() => navigate(item.route)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-body-sm transition-colors duration-150",
                          active
                            ? "bg-accent-gold/10 text-accent-gold"
                            : "text-text-secondary hover:bg-bg-tertiary hover:text-text-primary"
                        )}
                      >
                        <span
                          className={cn(
                            "shrink-0",
                            active ? "text-accent-gold" : "text-text-tertiary"
                          )}
                        >
                          {item.icon}
                        </span>
                        {item.label}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>
    </>
  );

  return (
    <>
      {/* Desktop fixed sidebar */}
      <aside className="fixed bottom-0 left-0 top-0 z-30 hidden w-[280px] flex-col border-r border-border-default bg-bg-secondary lg:flex">
        {sidebarContent}
      </aside>

      {/* Mobile drawer overlay */}
      {open && (
        <div
          className="fixed inset-0 z-50 bg-bg-overlay lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col border-r border-border-default bg-bg-secondary transition-transform duration-300 ease-in-out lg:hidden",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-border-muted px-5">
          <div className="flex items-center gap-3">
            <Trophy className="h-6 w-6 text-accent-gold" />
            <span className="text-h4 text-text-primary">BigScore</span>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-text-tertiary transition-colors hover:text-text-primary"
            aria-label="Close sidebar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {sidebarContent}
      </aside>
    </>
  );
}
