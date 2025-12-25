"use client";

import { useEffect, useMemo, useState } from "react";

import { useConfirm } from "@/components/ConfirmDialog";
import { FieldError, FormErrorSummary } from "@/components/FormErrors";
import { Button, Card, Input, Label, RefreshIconButton } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { getAccessToken, getTokenRole } from "@/lib/auth";
import { parseApiError, type FieldErrors } from "@/lib/formErrors";
import { toast } from "@/components/ToastProvider";

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
  const [formError, setFormError] = useState<string | null>(null);
  const [results, setResults] = useState<UserRow[]>([]);

  const [role, setRole] = useState<"" | Role>("");
  const [q, setQ] = useState("");

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("coach");
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);
  const [inviteFormError, setInviteFormError] = useState<string | null>(null);
  const [inviteFieldErrors, setInviteFieldErrors] = useState<FieldErrors | undefined>(undefined);
  const [creatingInvite, setCreatingInvite] = useState(false);

  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ role: Role; firstName: string; lastName: string; subscriptionStatus: string }>({
    role: "coach",
    firstName: "",
    lastName: "",
    subscriptionStatus: "inactive"
  });
  const [savingEdit, setSavingEdit] = useState(false);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (role) params.set("role", role);
    if (q.trim()) params.set("q", q.trim());
    params.set("limit", "100");
    return params.toString();
  }, [role, q]);

  async function load() {
    setFormError(null);
    setLoading(true);
    try {
      const token = getAccessToken();
      const tokenRole = getTokenRole(token);
      if (!token) throw new Error("Please login first.");
      if (tokenRole !== "admin") throw new Error("Insufficient permissions.");
      const res = await apiFetch<{ results: UserRow[] }>(`/admin/users?${query}`, { token });
      setResults(res.results);
    } catch (err) {
      const parsed = parseApiError(err);
      setFormError(parsed.formError ?? "Failed to load users");
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

    setFormError(null);
    try {
      const token = getAccessToken();
      const tokenRole = getTokenRole(token);
      if (!token) throw new Error("Please login first.");
      if (tokenRole !== "admin") throw new Error("Insufficient permissions.");
      await apiFetch(`/admin/users/${user.id}`, { method: "DELETE", token });
      await load();
    } catch (err) {
      const parsed = parseApiError(err);
      setFormError(parsed.formError ?? "Failed to delete user");
    }
  }

  function startEdit(u: UserRow) {
    setEditId(u.id);
    setEditForm({
      role: u.role,
      firstName: u.firstName ?? "",
      lastName: u.lastName ?? "",
      subscriptionStatus: u.subscriptionStatus ?? "inactive"
    });
  }

  async function saveEdit(u: UserRow) {
    setFormError(null);
    setSavingEdit(true);
    try {
      const token = getAccessToken();
      const tokenRole = getTokenRole(token);
      if (!token) throw new Error("Please login first.");
      if (tokenRole !== "admin") throw new Error("Insufficient permissions.");

      const payload: any = {
        role: editForm.role,
        firstName: editForm.firstName.trim() || undefined,
        lastName: editForm.lastName.trim() || undefined
      };
      if (editForm.role === "coach") payload.subscriptionStatus = editForm.subscriptionStatus || "inactive";

      await apiFetch(`/admin/users/${encodeURIComponent(u.id)}`, { method: "PATCH", token, body: JSON.stringify(payload) });
      toast({ kind: "success", title: "Saved", message: "User updated." });
      setEditId(null);
      await load();
    } catch (err) {
      const parsed = parseApiError(err);
      setFormError(parsed.formError ?? "Failed to update user");
    } finally {
      setSavingEdit(false);
    }
  }

  async function createInvite() {
    setInviteSuccess(null);
    setInviteFormError(null);
    setInviteFieldErrors(undefined);
    setCreatingInvite(true);
    try {
      const fe: FieldErrors = {};
      if (!inviteEmail.trim()) fe.inviteEmail = ["Email is required."];
      if (Object.keys(fe).length > 0) {
        setInviteFieldErrors(fe);
        return;
      }
      const token = getAccessToken();
      const tokenRole = getTokenRole(token);
      if (!token) throw new Error("Please login first.");
      if (tokenRole !== "admin") throw new Error("Insufficient permissions.");

      const res = await apiFetch<{
        invite: { email: string; role: string; token: string; expiresAt: string };
        emailSent?: boolean;
        emailError?: string;
      }>(
        "/admin/invites",
        {
        method: "POST",
        token,
        body: JSON.stringify({ email: inviteEmail, role: inviteRole })
        }
      );

      const link = `${window.location.origin}/invite`;
      if (res.emailSent) {
        setInviteSuccess(
          `Invite emailed to ${res.invite.email} (${res.invite.role}). Link: ${link} (code also shown below). Code: ${res.invite.token}`
        );
      } else {
        setInviteSuccess(
          `Invite created for ${res.invite.email} (${res.invite.role}). Email not sent${res.emailError ? ` (${res.emailError})` : ""}. Code: ${res.invite.token}. Link: ${link}`
        );
      }
      setInviteEmail("");
    } catch (err) {
      const parsed = parseApiError(err);
      setInviteFormError(parsed.formError ?? "Failed to create invite");
      setInviteFieldErrors(parsed.fieldErrors);
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
          <RefreshIconButton onClick={load} loading={loading} title="Refresh users" />
        </div>

        <div className="mt-4">
          <FormErrorSummary formError={formError ?? undefined} />
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

        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[color:var(--border)] text-[color:var(--color-text-muted)]">
                <th className="py-2 pr-4">Email</th>
                <th className="py-2 pr-4">Role</th>
                <th className="py-2 pr-4">Name</th>
                <th className="py-2 pr-4">Subscription</th>
                <th className="py-2 pr-4">Created</th>
                <th className="py-2 pr-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {results.map((u) => (
                <tr key={u.id} className="border-b border-[color:var(--border)]">
                  <td className="py-2 pr-4">{u.email}</td>
                  <td className="py-2 pr-4">
                    {editId === u.id ? (
                      <select
                        className="w-full rounded-md border border-[color:var(--border)] bg-[var(--surface-soft)] px-2 py-1 text-sm text-[color:var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-primary-600)]"
                        value={editForm.role}
                        onChange={(e) => setEditForm((f) => ({ ...f, role: e.target.value as Role }))}
                      >
                        <option value="player">player</option>
                        <option value="coach">coach</option>
                        <option value="evaluator">evaluator</option>
                        <option value="admin">admin</option>
                      </select>
                    ) : (
                      u.role
                    )}
                  </td>
                  <td className="py-2 pr-4">
                    {editId === u.id ? (
                      <div className="grid gap-2 sm:grid-cols-2">
                        <Input value={editForm.firstName} onChange={(e) => setEditForm((f) => ({ ...f, firstName: e.target.value }))} placeholder="First" />
                        <Input value={editForm.lastName} onChange={(e) => setEditForm((f) => ({ ...f, lastName: e.target.value }))} placeholder="Last" />
                      </div>
                    ) : u.firstName || u.lastName ? (
                      `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim()
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="py-2 pr-4">
                    {editId === u.id ? (
                      editForm.role === "coach" ? (
                        <select
                          className="w-full rounded-md border border-[color:var(--border)] bg-[var(--surface-soft)] px-2 py-1 text-sm text-[color:var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-primary-600)]"
                          value={editForm.subscriptionStatus}
                          onChange={(e) => setEditForm((f) => ({ ...f, subscriptionStatus: e.target.value }))}
                        >
                          <option value="inactive">inactive</option>
                          <option value="active">active</option>
                        </select>
                      ) : (
                        <span className="text-[color:var(--color-text-muted)]">—</span>
                      )
                    ) : (
                      u.role === "coach" ? u.subscriptionStatus ?? "inactive" : "—"
                    )}
                  </td>
                  <td className="py-2 pr-4">{u.createdAt ? new Date(u.createdAt).toLocaleString() : "-"}</td>
                  <td className="py-2 pr-4">
                    <div className="flex flex-wrap gap-2">
                      {editId === u.id ? (
                        <>
                          <Button type="button" onClick={() => saveEdit(u)} disabled={savingEdit}>
                            {savingEdit ? "Saving…" : "Save"}
                          </Button>
                          <Button
                            type="button"
                            className="border border-white/15 bg-white/5 text-white hover:bg-white/10"
                            onClick={() => setEditId(null)}
                            disabled={savingEdit}
                          >
                            Cancel
                          </Button>
                        </>
                      ) : (
                        <Button type="button" className="border border-white/15 bg-white/5 text-white hover:bg-white/10" onClick={() => startEdit(u)}>
                          Edit
                        </Button>
                      )}
                      <Button
                        type="button"
                        className="border border-white/15 bg-white/5 text-white hover:bg-white/10"
                        onClick={() => deleteUser(u)}
                        disabled={savingEdit && editId === u.id}
                      >
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {results.length === 0 ? (
                <tr>
                  <td className="py-4 text-[color:var(--color-text-muted)]" colSpan={6}>
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

        <div className="mt-4">
          <FormErrorSummary formError={inviteFormError ?? undefined} fieldErrors={inviteFieldErrors} />
          {inviteSuccess ? <div className="mt-3 text-sm text-[color:var(--color-text-muted)]">{inviteSuccess}</div> : null}
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="adminInviteEmail">Email</Label>
            <Input id="adminInviteEmail" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} autoComplete="off" />
            <FieldError name="inviteEmail" fieldErrors={inviteFieldErrors} />
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
        </div>
      </Card>
    </div>
  );
}


