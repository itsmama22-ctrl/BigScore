"use client";

import { useEffect, useState, useCallback } from "react";
import {
  collection,
  query,
  orderBy,
  getDocs,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { queryWithFallback } from "@/lib/queryWithFallback";
import { useAuth } from "@/hooks/useAuth";
import {
  changeRoleAction,
  toggleUserStatusAction,
  sendPasswordResetAction,
  inviteAdminUserAction,
} from "@/app/actions/users";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Modal } from "@/components/ui/modal";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { AdminRole } from "@/lib/auth/permissions";
import {
  Search,
  X,
  Users,
  UserPlus,
  KeyRound,
  Shield,
  Clock,
  Mail,
  Copy,
  Check,
} from "lucide-react";

interface AdminUserData {
  uid: string;
  email: string;
  displayName: string | null;
  role: AdminRole;
  status: "active" | "disabled";
  createdAt?: { seconds: number };
  lastLoginAt?: { seconds: number };
}

const roleBadgeVariant: Record<string, "gold" | "blue" | "green" | "purple"> = {
  super_admin: "gold",
  content_manager: "blue",
  moderator: "green",
  viewer: "purple",
};

const validRoles: AdminRole[] = [
  "super_admin",
  "content_manager",
  "moderator",
  "viewer",
];

function formatDate(ts?: { seconds: number }): string {
  if (!ts) return "--";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(ts.seconds * 1000));
}

export default function UsersPage() {
  const { adminProfile } = useAuth();

  const [users, setUsers] = useState<AdminUserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // Invite modal
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState<AdminRole>("content_manager");
  const [inviting, setInviting] = useState(false);
  const [inviteResult, setInviteResult] = useState<{
    resetLink?: string;
  } | null>(null);

  // Role change modal
  const [roleTarget, setRoleTarget] = useState<AdminUserData | null>(null);
  const [newRole, setNewRole] = useState<AdminRole>("viewer");
  const [roleSaving, setRoleSaving] = useState(false);

  // Action state
  const [actionBusy, setActionBusy] = useState<Set<string>>(new Set());
  const [copiedUid, setCopiedUid] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Activity
  const [activityUser, setActivityUser] = useState<AdminUserData | null>(null);
  const [activityCount, setActivityCount] = useState(0);
  const [activityOpen, setActivityOpen] = useState(false);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const list = await Promise.race([
        (async () => {
          const q = query(collection(db, "adminUsers"), orderBy("email"));
          const snap = await getDocs(q);
          const resultList: AdminUserData[] = [];
          snap.forEach((d) => {
            const data = d.data();
            resultList.push({
              uid: d.id,
              email: data.email ?? "",
              displayName: data.displayName ?? null,
              role: data.role ?? "viewer",
              status: data.status ?? "active",
              createdAt: data.createdAt,
              lastLoginAt: data.lastLoginAt,
            });
          });
          return resultList;
        })(),
        new Promise<"__timeout__">((resolve) =>
          setTimeout(() => resolve("__timeout__"), 4000)
        ),
      ]);

      if (list === "__timeout__") {
        const fallback = await queryWithFallback({
          collection: "adminUsers",
          orderByField: "email",
          orderByDir: "asc",
          limitCount: 200,
        }) as unknown as AdminUserData[];
        setUsers(fallback);
      } else {
        setUsers(list);
      }
    } catch (err) {
      console.error("[users]", err);
      setError("Failed to load users.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  function isBusy(uid: string) {
    return actionBusy.has(uid);
  }

  function setBusy(uid: string) {
    setActionBusy((prev) => new Set(prev).add(uid));
  }

  function clearBusy(uid: string) {
    setActionBusy((prev) => {
      const next = new Set(prev);
      next.delete(uid);
      return next;
    });
  }

  async function handleChangeRole() {
    if (!roleTarget || !adminProfile) return;

    setRoleSaving(true);

    const result = await changeRoleAction({
      targetUid: roleTarget.uid,
      targetEmail: roleTarget.email,
      newRole,
      actor: {
        uid: adminProfile.uid,
        email: adminProfile.email,
        role: adminProfile.role,
      },
    });

    setRoleSaving(false);

    if (result.success) {
      setToast({ type: "success", message: `Role updated to ${newRole}.` });
      setRoleTarget(null);
      loadUsers();
    } else {
      setToast({
        type: "error",
        message: result.error ?? "Failed to update role.",
      });
    }
  }

  async function handleToggleStatus(user: AdminUserData) {
    if (!adminProfile) return;

    const newStatus = user.status === "active" ? "disabled" : "active";
    setBusy(user.uid);

    const result = await toggleUserStatusAction({
      targetUid: user.uid,
      targetEmail: user.email,
      newStatus,
      actor: {
        uid: adminProfile.uid,
        email: adminProfile.email,
        role: adminProfile.role,
      },
    });

    clearBusy(user.uid);

    if (result.success) {
      setToast({
        type: "success",
        message: `User ${newStatus === "disabled" ? "disabled" : "enabled"}.`,
      });
      loadUsers();
    } else {
      setToast({
        type: "error",
        message: result.error ?? "Failed to update status.",
      });
    }
  }

  async function handleSendReset(user: AdminUserData) {
    if (!adminProfile) return;

    setBusy(user.uid);

    const result = await sendPasswordResetAction({
      targetEmail: user.email,
      actor: {
        uid: adminProfile.uid,
        email: adminProfile.email,
        role: adminProfile.role,
      },
    });

    clearBusy(user.uid);

    if (result.success && "resetLink" in result) {
      const link = (result as { resetLink?: string }).resetLink;
      if (link) {
        setToast({
          type: "success",
          message: `Reset link generated. Copying to clipboard...`,
        });
        await navigator.clipboard.writeText(link);
        setCopiedUid(user.uid);
        setTimeout(() => setCopiedUid(null), 3000);
      }
    } else {
      setToast({
        type: "error",
        message: result.error ?? "Failed to generate reset link.",
      });
    }
  }

  async function handleInvite() {
    if (!adminProfile || !inviteEmail.trim()) return;

    setInviting(true);
    setInviteResult(null);

    const result = await inviteAdminUserAction({
      email: inviteEmail.trim(),
      displayName: inviteName.trim() || inviteEmail.trim().split("@")[0],
      role: inviteRole,
      actor: {
        uid: adminProfile.uid,
        email: adminProfile.email,
        role: adminProfile.role,
      },
    });

    setInviting(false);

    if (result.success) {
      setToast({ type: "success", message: `Invited ${inviteEmail}.` });
      const link = (result as { resetLink?: string }).resetLink;
      if (link) {
        setInviteResult({ resetLink: link });
      } else {
        setInviteOpen(false);
        resetInviteForm();
      }
      loadUsers();
    } else {
      setToast({
        type: "error",
        message: result.error ?? "Failed to invite user.",
      });
      setInviteResult(null);
    }
  }

  function resetInviteForm() {
    setInviteEmail("");
    setInviteName("");
    setInviteRole("content_manager");
    setInviteResult(null);
  }

  async function handleViewActivity(user: AdminUserData) {
    setActivityUser(user);
    try {
      const list = await Promise.race([
        (async () => {
          const logsSnap = await getDocs(
            query(
              collection(db, "auditLogs"),
              orderBy("createdAt", "desc")
            )
          );
          let count = 0;
          logsSnap.forEach((d) => {
            if (d.data().actorUid === user.uid) count++;
          });
          return count;
        })(),
        new Promise<"__timeout__">((resolve) =>
          setTimeout(() => resolve("__timeout__"), 4000)
        ),
      ]);

      if (list === "__timeout__") {
        const fallback = await queryWithFallback({
          collection: "auditLogs",
          orderByField: "createdAt",
          orderByDir: "desc",
          limitCount: 200,
          filters: [{ field: "actorUid", op: "==", value: user.uid }],
        });
        setActivityCount(fallback.length);
      } else {
        setActivityCount(list as number);
      }
    } catch {
      setActivityCount(0);
    }
    setActivityOpen(true);
  }

  const filtered = users.filter((u) => {
    if (search) {
      const s = search.toLowerCase();
      if (
        !u.email.toLowerCase().includes(s) &&
        !(u.displayName ?? "").toLowerCase().includes(s)
      )
        return false;
    }
    if (roleFilter !== "all" && u.role !== roleFilter) return false;
    if (statusFilter !== "all" && u.status !== statusFilter) return false;
    return true;
  });

  return (
    <div className="flex flex-col gap-6">
      {/* Toast */}
      {toast && (
        <div
          className={cn(
            "fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-lg border px-4 py-3 shadow-lg",
            toast.type === "success"
              ? "border-accent-green/30 bg-accent-green/10"
              : "border-accent-red/30 bg-accent-red/10"
          )}
        >
          <p className="text-body text-text-primary">{toast.message}</p>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-h2 text-text-primary">Admin Users</h1>
          <p className="text-body text-text-tertiary">
            Manage admin accounts and permissions
          </p>
        </div>
        <Button variant="primary" onClick={() => setInviteOpen(true)} className="shrink-0">
          <UserPlus className="h-4 w-4" />
          Invite Admin
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
            <input
              type="text"
              placeholder="Search by email or name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-border-default bg-bg-tertiary py-2.5 pl-10 pr-4 text-body text-text-primary placeholder:text-text-disabled focus:border-border-focus focus:outline-none focus:ring-1 focus:ring-border-focus"
            />
          </div>

          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="rounded-lg border border-border-default bg-bg-tertiary px-3 py-2.5 text-body-sm text-text-primary focus:border-border-focus focus:outline-none"
          >
            <option value="all">All Roles</option>
            {validRoles.map((r) => (
              <option key={r} value={r}>
                {r.replace("_", " ")}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-border-default bg-bg-tertiary px-3 py-2.5 text-body-sm text-text-primary focus:border-border-focus focus:outline-none"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="disabled">Disabled</option>
          </select>

          {(search || roleFilter !== "all" || statusFilter !== "all") && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch("");
                setRoleFilter("all");
                setStatusFilter("all");
              }}
            >
              <X className="h-4 w-4" />
              Clear
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <Card className="border-border-error">
          <CardContent className="flex items-center justify-between p-4">
            <p className="text-body text-accent-red">{error}</p>
            <Button variant="ghost" size="sm" onClick={loadUsers}>
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Loading */}
      {loading && (
        <Card>
          <CardContent className="space-y-3 p-0">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-14 animate-pulse border-b border-border-muted bg-bg-secondary"
              />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Empty */}
      {!loading && filtered.length === 0 && !error && (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-16">
            <Users className="h-10 w-10 text-text-disabled" />
            <p className="text-body text-text-tertiary">
              {search || roleFilter !== "all" || statusFilter !== "all"
                ? "No users match your filters."
                : "No admin users yet."}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Table */}
      {!loading && filtered.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border-muted bg-bg-tertiary">
                    <th className="px-4 py-3 text-left text-label text-text-tertiary">
                      Email
                    </th>
                    <th className="px-4 py-3 text-left text-label text-text-tertiary">
                      Display Name
                    </th>
                    <th className="px-4 py-3 text-left text-label text-text-tertiary">
                      Role
                    </th>
                    <th className="px-4 py-3 text-left text-label text-text-tertiary">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-label text-text-tertiary whitespace-nowrap">
                      Created
                    </th>
                    <th className="px-4 py-3 text-left text-label text-text-tertiary whitespace-nowrap">
                      Last Login
                    </th>
                    <th className="px-4 py-3 text-right text-label text-text-tertiary">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((u, idx) => (
                    <tr
                      key={u.uid}
                      className={cn(
                        "transition-colors hover:bg-bg-tertiary/50",
                        idx !== filtered.length - 1 &&
                          "border-b border-border-muted"
                      )}
                    >
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1.5">
                          <Mail className="h-3.5 w-3.5 text-text-disabled" />
                          <span className="text-body-sm text-text-primary">
                            {u.email}
                          </span>
                        </span>
                      </td>
                      <td className="px-4 py-3 text-body-sm text-text-secondary">
                        {u.displayName || "--"}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <button
                          onClick={() => {
                            if (u.uid === adminProfile?.uid) return;
                            setRoleTarget(u);
                            setNewRole(u.role);
                          }}
                          className={cn(
                            "capitalize",
                            u.uid !== adminProfile?.uid &&
                              "cursor-pointer hover:opacity-80"
                          )}
                          disabled={u.uid === adminProfile?.uid}
                        >
                          <Badge variant={roleBadgeVariant[u.role] || "purple"}>
                            {u.role.replace("_", " ")}
                          </Badge>
                        </button>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <Switch
                          checked={u.status === "active"}
                          onCheckedChange={() => handleToggleStatus(u)}
                          disabled={
                            isBusy(u.uid) || u.uid === adminProfile?.uid
                          }
                          aria-label={`Toggle status for ${u.email}`}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1.5 text-body-sm text-text-tertiary whitespace-nowrap">
                          <Clock className="h-3.5 w-3.5" />
                          {formatDate(u.createdAt)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1.5 text-body-sm text-text-tertiary whitespace-nowrap">
                          <Clock className="h-3.5 w-3.5" />
                          {formatDate(u.lastLoginAt)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleSendReset(u)}
                            disabled={isBusy(u.uid)}
                            className="rounded-md p-1.5 text-text-tertiary transition-colors hover:bg-bg-tertiary hover:text-accent-blue"
                            title="Send password reset email"
                          >
                            {copiedUid === u.uid ? (
                              <Check className="h-4 w-4 text-accent-green" />
                            ) : (
                              <KeyRound className="h-4 w-4" />
                            )}
                          </button>

                          <button
                            onClick={() => handleViewActivity(u)}
                            className="rounded-md p-1.5 text-text-tertiary transition-colors hover:bg-bg-tertiary hover:text-text-secondary"
                            title="View recent activity"
                          >
                            <Shield className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Invite Modal */}
      <Modal
        open={inviteOpen}
        onClose={() => {
          setInviteOpen(false);
          resetInviteForm();
        }}
        title="Invite Admin User"
        description={inviteResult ? undefined : "Create a new admin account and send a password reset link."}
        size="md"
      >
        <div className="flex flex-col gap-4">
          {inviteResult && inviteResult.resetLink ? (
            <>
              <div className="rounded-lg border border-accent-green/30 bg-accent-green/10 p-4">
                <p className="text-body-sm text-text-primary">
                  User created. A password reset link has been generated:
                </p>
                <p className="mt-2 break-all rounded border border-border-default bg-bg-primary p-2 text-body-sm text-text-secondary font-mono">
                  {inviteResult.resetLink}
                </p>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(inviteResult.resetLink!);
                    setToast({
                      type: "success",
                      message: "Reset link copied.",
                    });
                  }}
                >
                  <Copy className="h-4 w-4" />
                  Copy Link
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setInviteOpen(false);
                    resetInviteForm();
                  }}
                >
                  Done
                </Button>
              </div>
            </>
          ) : (
            <>
              <Input
                label="Email Address"
                type="email"
                placeholder="admin@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                autoFocus
              />

              <Input
                label="Display Name"
                placeholder="John Smith"
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
              />

              <div>
                <label className="mb-1.5 block text-label text-text-secondary">
                  Role
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) =>
                    setInviteRole(e.target.value as AdminRole)
                  }
                  className="w-full rounded-lg border border-border-default bg-bg-tertiary px-3 py-2.5 text-body text-text-primary focus:border-border-focus focus:outline-none"
                >
                  {validRoles.map((r) => (
                    <option key={r} value={r}>
                      {r.replace("_", " ")}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setInviteOpen(false);
                    resetInviteForm();
                  }}
                  disabled={inviting}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  loading={inviting}
                  onClick={handleInvite}
                  disabled={!inviteEmail.trim()}
                >
                  Invite
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* Change Role Modal */}
      <Modal
        open={!!roleTarget}
        onClose={() => {
          setRoleTarget(null);
        }}
        title="Change Role"
        size="sm"
      >
        {roleTarget && (
          <div className="flex flex-col gap-4">
            <p className="text-body text-text-secondary">
              Change role for{" "}
              <span className="font-semibold text-text-primary">
                {roleTarget.displayName || roleTarget.email}
              </span>
            </p>

            <div>
              <label className="mb-1.5 block text-label text-text-secondary">
                New Role
              </label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as AdminRole)}
                className="w-full rounded-lg border border-border-default bg-bg-tertiary px-3 py-2.5 text-body text-text-primary focus:border-border-focus focus:outline-none"
              >
                {validRoles.map((r) => (
                  <option key={r} value={r}>
                    {r.replace("_", " ")}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-3">
              <Button
                variant="ghost"
                onClick={() => setRoleTarget(null)}
                disabled={roleSaving}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                loading={roleSaving}
                onClick={handleChangeRole}
              >
                Save
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Activity Modal */}
      <Modal
        open={activityOpen}
        onClose={() => {
          setActivityOpen(false);
          setActivityUser(null);
        }}
        title="User Activity"
        size="sm"
      >
        {activityUser && (
          <div className="flex flex-col gap-4">
            <div className="rounded-lg border border-border-muted bg-bg-primary p-4">
              <p className="text-body-sm text-text-secondary">
                <span className="font-medium text-text-primary">
                  {activityUser.displayName || activityUser.email}
                </span>{" "}
                has performed{" "}
                <span className="font-semibold text-accent-gold">
                  {activityCount}
                </span>{" "}
                audited actions.
              </p>
            </div>

            <Button
              variant="ghost"
              onClick={() => {
                setActivityOpen(false);
                setActivityUser(null);
              }}
            >
              Close
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
}
