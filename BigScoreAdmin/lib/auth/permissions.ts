export type AdminRole =
  | "super_admin"
  | "content_manager"
  | "moderator"
  | "viewer";

export const rolePermissions: Record<AdminRole, string[]> = {
  super_admin: ["*"],
  content_manager: [
    "matches:write",
    "packages:write",
    "channels:write",
    "news:write",
    "competitions:write",
    "teams:write",
  ],
  moderator: ["notifications:send", "analytics:read", "matches:read"],
  viewer: ["analytics:read", "content:read"],
};

export function hasPermission(role: AdminRole, permission: string): boolean {
  const permissions = rolePermissions[role] || [];
  return permissions.includes("*") || permissions.includes(permission);
}

export const routePermissions: Record<string, AdminRole[]> = {
  "/dashboard": ["super_admin", "content_manager", "moderator", "viewer"],
  "/matches": ["super_admin", "content_manager", "moderator", "viewer"],
  "/packages": ["super_admin", "content_manager", "viewer"],
  "/news": ["super_admin", "content_manager", "viewer"],
  "/competitions": ["super_admin", "content_manager", "viewer"],
  "/teams": ["super_admin", "content_manager", "viewer"],
  "/config": ["super_admin"],
  "/users": ["super_admin"],
  "/notifications": ["super_admin", "moderator"],
  "/analytics": ["super_admin", "content_manager", "moderator", "viewer"],
  "/audit-logs": ["super_admin"],
};

export function isRouteAuthorized(
  pathname: string,
  role: AdminRole | null | undefined
): boolean {
  if (!role) return false;

  const routeKey = Object.keys(routePermissions).find((route) =>
    pathname.startsWith(route)
  );

  if (!routeKey) return true;

  return routePermissions[routeKey].includes(role);
}

export function getDashboardRoute(role: AdminRole): string {
  if (role === "super_admin" || role === "content_manager" || role === "moderator") {
    return "/dashboard";
  }
  return "/dashboard";
}
