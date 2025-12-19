"use client";

import { useEffect, useMemo, useState } from "react";

import { useConfirm } from "@/components/ConfirmDialog";
import { Button, Card, Input, Label } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { getAccessToken, getTokenRole } from "@/lib/auth";

type Role = "player" | "coach" | "evaluator" | "admin";

type UserRow = {
  id: string;
  email: string;
  role: Role;
  firstName?: string;
  lastName?: string;
  subscriptionStatus?: string;
  createdAt?: string;
};

export function AdminUserManager() {
  const confirm = useConfirm();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<UserRow[]>([]);

  const [role, setRole] = useState<"" | Role>("");
  const [q, setQ] = useState("");

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("coach");
  const [inviteStatus, setInviteStatus] = useState<string | null>(null);
  const [creatingInvite, setCreatingInvite] = useState(false);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (role) params.set("role", role);
    if (q.trim()) params.set("q", q.trim());
    params.set("limit", "100");
    return params.toString();
  }, [role, q]);

  async function load() {
    setError(null);
    setLoading(true);
    try {
      const token = getAccessToken();
      const tokenRole = getTokenRole(token);
      if (!token) throw new Error("Please login first.");
      if (tokenRole !== "admin") throw new Error("Insufficient permissions.");
      const res = await apiFetch<{ results: UserRow[] }>(`/admin/users?${query}`, { token });
      setResults(res.results);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  async function deleteUser(user: UserRow) {
    const ok = await confirm({
      title: `Delete ${user.role} user?`,
      message: `Delete ${user.email}? This cannot be undone.`,
      confirmText: "Delete",
      cancelText: "Cancel",
      destructive: true
    });
    if (!ok) return;

    setError(null);
    try {
      const token = getAccessToken();
      const tokenRole = getTokenRole(token);
      if (!token) throw new Error("Please login first.");
      if (tokenRole !== "admin") throw new Error("Insufficient permissions.");
      await apiFetch(`/admin/users/${user.id}`, { method: "DELETE", token });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete user");
    }
  }

  async function createInvite() {
    setInviteStatus(null);
    setCreatingInvite(true);
    try {
      const token = getAccessToken();
      const tokenRole = getTokenRole(token);
      if (!token) throw new Error("Please login first.");
      if (tokenRole !== "admin") throw new Error("Insufficient permissions.");

      const res = await apiFetch<{ invite: { email: string; role: string; token: string; expiresAt: string } }>("/admin/invites", {
        method: "POST",
        token,
        body: JSON.stringify({ email: inviteEmail, role: inviteRole })
      });

      const link = `${window.location.origin}/invite`;
      setInviteStatus(`Invite for ${res.invite.email} (${res.invite.role}). Code: ${res.invite.token}. Link: ${link}`);
      setInviteEmail("");
    } catch (err) {
      setInviteStatus(err instanceof Error ? err.message : "Failed to create invite");
    } finally {
      setCreatingInvite(false);
    }
  }

  return (
    <div className="grid gap-6">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">User management</h2>
            <p className="mt-1 text-sm text-white/80">Search users, delete users, and generate invite codes.</p>
          </div>
          <Button type="button" onClick={load} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </Button>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="grid gap-2">
            <Label htmlFor="role">Role</Label>
            <select
              id="role"
              className="w-full rounded-md border border-[color:var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm text-[color:var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-primary-600)]"
              value={role}
              onChange={(e) => setRole(e.target.value as any)}
            >
              <option value="">All</option>
              <option value="player">Player</option>
              <option value="coach">Coach</option>
              <option value="evaluator">Evaluator</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="q">Search (email)</Label>
            <Input id="q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="name@school.org" />
          </div>
        </div>

        {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}

        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[color:var(--border)] text-[color:var(--color-text-muted)]">
                <th className="py-2 pr-4">Email</th>
                <th className="py-2 pr-4">Role</th>
                <th className="py-2 pr-4">Name</th>
                <th className="py-2 pr-4">Created</th>
                <th className="py-2 pr-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {results.map((u) => (
                <tr key={u.id} className="border-b border-[color:var(--border)]">
                  <td className="py-2 pr-4">{u.email}</td>
                  <td className="py-2 pr-4">{u.role}</td>
                  <td className="py-2 pr-4">{u.firstName || u.lastName ? `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() : "-"}</td>
                  <td className="py-2 pr-4">{u.createdAt ? new Date(u.createdAt).toLocaleString() : "-"}</td>
                  <td className="py-2 pr-4">
                    <Button
                      type="button"
                      className="border border-white/15 bg-white/5 text-white hover:bg-white/10"
                      onClick={() => deleteUser(u)}
                    >
                      Delete
                    </Button>
                  </td>
                </tr>
              ))}
              {results.length === 0 ? (
                <tr>
                  <td className="py-4 text-[color:var(--color-text-muted)]" colSpan={5}>
                    No users found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold">Generate invite</h2>
        <p className="mt-1 text-sm text-white/80">Creates a one-time code. Share the code + link so they can create an account.</p>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="inviteEmail">Email</Label>
            <Input id="inviteEmail" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} autoComplete="off" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="inviteRole">Role</Label>
            <select
              id="inviteRole"
              className="w-full rounded-md border border-[color:var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm text-[color:var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-primary-600)]"
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as Role)}
            >
              <option value="player">Player</option>
              <option value="coach">Coach</option>
              <option value="evaluator">Evaluator</option>
              <option value="admin">Admin</option>
            </select>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <Button type="button" onClick={createInvite} disabled={creatingInvite || !inviteEmail.trim()}>
            {creatingInvite ? "Creating..." : "Create invite"}
          </Button>
          {inviteStatus ? <p className="text-sm text-[color:var(--color-text-muted)]">{inviteStatus}</p> : null}
        </div>
      </Card>
    </div>
  );
}


