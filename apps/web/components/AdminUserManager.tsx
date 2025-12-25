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
  username?: string;
  role: Role;
  firstName?: string;
  lastName?: string;
  subscriptionStatus?: string;
  isActive?: boolean;
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

  const [editOpen, setEditOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editUserId, setEditUserId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{
    email: string;
    username: string;
    role: Role;
    firstName: string;
    lastName: string;
    subscriptionStatus: string;
    isActive: boolean;
    profilePublic: boolean;
    playerContactVisibleToSubscribedCoaches: boolean;
    profileCity: string;
    profileState: string;
    newPassword: string;
  }>({
    email: "",
    username: "",
    role: "coach",
    firstName: "",
    lastName: "",
    subscriptionStatus: "inactive",
    isActive: true,
    profilePublic: false,
    playerContactVisibleToSubscribedCoaches: false,
    profileCity: "",
    profileState: "",
    newPassword: ""
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

  async function openEditModal(userId: string) {
    setFormError(null);
    setEditOpen(true);
    setEditLoading(true);
    setEditUserId(userId);
    try {
      const token = getAccessToken();
      const tokenRole = getTokenRole(token);
      if (!token) throw new Error("Please login first.");
      if (tokenRole !== "admin") throw new Error("Insufficient permissions.");

      const detail = await apiFetch<{
        user: UserRow & { subscriptionStatus?: string; isActive?: boolean };
        profile: {
          profileExists: boolean;
          city?: string;
          state?: string;
          profilePublic?: boolean;
          playerContactVisibleToSubscribedCoaches?: boolean;
        };
      }>(`/admin/users/${encodeURIComponent(userId)}/detail`, { token, retries: 4, retryOn404: true });

      setEditForm({
        email: detail.user.email ?? "",
        username: detail.user.username ?? "",
        role: detail.user.role,
        firstName: detail.user.firstName ?? "",
        lastName: detail.user.lastName ?? "",
        subscriptionStatus: detail.user.subscriptionStatus ?? "inactive",
        isActive: detail.user.isActive !== false,
        profilePublic: Boolean(detail.profile?.profilePublic),
        playerContactVisibleToSubscribedCoaches: Boolean(detail.profile?.playerContactVisibleToSubscribedCoaches),
        profileCity: detail.profile?.city ?? "",
        profileState: detail.profile?.state ?? "",
        newPassword: ""
      });
    } catch (err) {
      const parsed = parseApiError(err);
      setFormError(parsed.formError ?? "Failed to load user details");
      setEditOpen(false);
      setEditUserId(null);
    } finally {
      setEditLoading(false);
    }
  }

  async function saveEdit() {
    setFormError(null);
    setSavingEdit(true);
    try {
      const token = getAccessToken();
      const tokenRole = getTokenRole(token);
      if (!token) throw new Error("Please login first.");
      if (tokenRole !== "admin") throw new Error("Insufficient permissions.");
      if (!editUserId) throw new Error("No user selected.");

      const payload: any = {
        email: editForm.email.trim() || undefined,
        username: editForm.username.trim() || undefined,
        role: editForm.role,
        firstName: editForm.firstName.trim() || undefined,
        lastName: editForm.lastName.trim() || undefined,
        isActive: editForm.isActive,
        ...(typeof editForm.profilePublic === "boolean" ? { profilePublic: editForm.profilePublic } : {}),
        ...(typeof editForm.playerContactVisibleToSubscribedCoaches === "boolean"
          ? { playerContactVisibleToSubscribedCoaches: editForm.playerContactVisibleToSubscribedCoaches }
          : {})
      };
      if (editForm.role === "coach") payload.subscriptionStatus = editForm.subscriptionStatus || "inactive";
      if (editForm.newPassword.trim()) payload.newPassword = editForm.newPassword;
      if (editForm.profileCity.trim()) payload.profileCity = editForm.profileCity.trim();
      if (editForm.profileState.trim()) payload.profileState = editForm.profileState.trim();

      await apiFetch(`/admin/users/${encodeURIComponent(editUserId)}`, {
        method: "PATCH",
        token,
        body: JSON.stringify(payload),
        retries: 4,
        retryOn404: true
      });
      toast({ kind: "success", title: "Saved", message: "User updated." });
      setEditOpen(false);
      setEditUserId(null);
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

        <div className="mt-6">
          <table className="w-full table-fixed text-left text-sm">
            <colgroup>
              <col className="w-[26%]" />
              <col className="w-[14%]" />
              <col className="w-[10%]" />
              <col className="w-[22%]" />
              <col className="w-[10%]" />
              <col className="w-[8%]" />
              <col className="hidden xl:table-column w-[10%]" />
              <col className="w-[14%]" />
            </colgroup>
            <thead>
              <tr className="border-b border-[color:var(--border)] text-[color:var(--color-text-muted)]">
                <th className="py-2 pr-4">Email</th>
                <th className="py-2 pr-4">Username</th>
                <th className="py-2 pr-4">Role</th>
                <th className="py-2 pr-4">Name</th>
                <th className="py-2 pr-4">Subscription</th>
                <th className="py-2 pr-4">Active</th>
                <th className="hidden xl:table-cell py-2 pr-4">Created</th>
                <th className="py-2 pr-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {results.map((u) => (
                <tr key={u.id} className="border-b border-[color:var(--border)] align-top">
                  <td className="py-2 pr-4 break-words">
                    {u.email}
                  </td>
                  <td className="py-2 pr-4 break-words">
                    {u.username ?? "—"}
                  </td>
                  <td className="py-2 pr-4">
                    {u.role}
                  </td>
                  <td className="py-2 pr-4">
                    {u.firstName || u.lastName ? (
                      `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim()
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="py-2 pr-4">
                    {u.role === "coach" ? u.subscriptionStatus ?? "inactive" : "—"}
                  </td>
                  <td className="py-2 pr-4">
                    {u.isActive === false ? "disabled" : "active"}
                  </td>
                  <td className="hidden xl:table-cell py-2 pr-4">{u.createdAt ? new Date(u.createdAt).toLocaleString() : "-"}</td>
                  <td className="py-2 pr-4">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        className="border border-white/15 bg-white/5 text-white hover:bg-white/10"
                        onClick={() => void openEditModal(u.id)}
                      >
                        Edit
                      </Button>
                      <Button
                        type="button"
                        className="border border-white/15 bg-white/5 text-white hover:bg-white/10"
                        onClick={() => deleteUser(u)}
                        disabled={savingEdit}
                      >
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {results.length === 0 ? (
                <tr>
                  <td className="py-4 text-[color:var(--color-text-muted)]" colSpan={8}>
                    No users found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>

      {editOpen ? (
        <div
          className="fixed inset-0 z-[120] flex items-start justify-center overflow-y-auto bg-black/70 px-4 py-10"
          role="dialog"
          aria-modal="true"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !savingEdit) {
              setEditOpen(false);
              setEditUserId(null);
            }
          }}
        >
          <div className="w-full max-w-3xl">
            <Card className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold">Edit user</h3>
                  <p className="mt-1 text-sm text-white/70">Full user + profile view (including city/state).</p>
                </div>
                <Button
                  type="button"
                  className="border border-white/15 bg-white/5 text-white hover:bg-white/10"
                  onClick={() => {
                    if (savingEdit) return;
                    setEditOpen(false);
                    setEditUserId(null);
                  }}
                  disabled={savingEdit}
                >
                  Close
                </Button>
              </div>

              {editLoading ? (
                <div className="mt-6 text-sm text-white/70">Loading…</div>
              ) : (
                <>
                  <div className="mt-6 grid gap-4 sm:grid-cols-2">
                    <div className="grid gap-1.5">
                      <Label>Email</Label>
                      <Input value={editForm.email} onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))} />
                    </div>
                    <div className="grid gap-1.5">
                      <Label>Username</Label>
                      <Input
                        value={editForm.username}
                        onChange={(e) => setEditForm((f) => ({ ...f, username: e.target.value }))}
                        placeholder="(optional)"
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label>Role</Label>
                      <select
                        className="h-10 w-full rounded-md border border-[color:var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm text-[color:var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-primary-600)]"
                        value={editForm.role}
                        onChange={(e) => setEditForm((f) => ({ ...f, role: e.target.value as Role }))}
                      >
                        <option value="player">player</option>
                        <option value="coach">coach</option>
                        <option value="evaluator">evaluator</option>
                        <option value="admin">admin</option>
                      </select>
                    </div>
                    <div className="grid gap-1.5">
                      <Label>Status</Label>
                      <label className="mt-1 inline-flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={editForm.isActive}
                          onChange={(e) => setEditForm((f) => ({ ...f, isActive: e.target.checked }))}
                        />
                        <span className="text-[color:var(--muted)]">{editForm.isActive ? "Active" : "Disabled"}</span>
                      </label>
                    </div>
                    <div className="grid gap-1.5">
                      <Label>First name</Label>
                      <Input value={editForm.firstName} onChange={(e) => setEditForm((f) => ({ ...f, firstName: e.target.value }))} />
                    </div>
                    <div className="grid gap-1.5">
                      <Label>Last name</Label>
                      <Input value={editForm.lastName} onChange={(e) => setEditForm((f) => ({ ...f, lastName: e.target.value }))} />
                    </div>

                    {editForm.role === "coach" ? (
                      <div className="grid gap-1.5 sm:col-span-2">
                        <Label>Subscription</Label>
                        <select
                          className="h-10 w-full rounded-md border border-[color:var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm text-[color:var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-primary-600)]"
                          value={editForm.subscriptionStatus}
                          onChange={(e) => setEditForm((f) => ({ ...f, subscriptionStatus: e.target.value }))}
                        >
                          <option value="inactive">inactive</option>
                          <option value="active">active</option>
                        </select>
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-4">
                    <div className="text-sm font-semibold text-white/90">Profile (location + visibility)</div>
                    <div className="mt-3 grid gap-4 sm:grid-cols-2">
                      <div className="grid gap-1.5">
                        <Label>City</Label>
                        <Input value={editForm.profileCity} onChange={(e) => setEditForm((f) => ({ ...f, profileCity: e.target.value }))} />
                      </div>
                      <div className="grid gap-1.5">
                        <Label>State</Label>
                        <Input
                          value={editForm.profileState}
                          onChange={(e) => setEditForm((f) => ({ ...f, profileState: e.target.value }))}
                          placeholder="e.g. TX"
                        />
                      </div>
                    </div>
                    <div className="mt-4 grid gap-2">
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={editForm.profilePublic}
                          onChange={(e) => setEditForm((f) => ({ ...f, profilePublic: e.target.checked }))}
                        />
                        <span className="text-[color:var(--muted)]">Public profile</span>
                      </label>
                      {editForm.role === "player" ? (
                        <label className="inline-flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={editForm.playerContactVisibleToSubscribedCoaches}
                            onChange={(e) => setEditForm((f) => ({ ...f, playerContactVisibleToSubscribedCoaches: e.target.checked }))}
                          />
                          <span className="text-[color:var(--muted)]">Contact visible to subscribed coaches</span>
                        </label>
                      ) : null}
                      {editForm.role === "player" ? (
                        <div className="text-xs text-[color:var(--muted-2)]">
                          Note: if the player hasn’t saved a player profile yet, publishing/location edits will be blocked.
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-4">
                    <div className="text-sm font-semibold text-white/90">Security</div>
                    <div className="mt-3 grid gap-2">
                      <Label>Set new password (optional)</Label>
                      <Input
                        type="password"
                        value={editForm.newPassword}
                        onChange={(e) => setEditForm((f) => ({ ...f, newPassword: e.target.value }))}
                        placeholder="Min 8 characters"
                      />
                      <div className="text-xs text-[color:var(--muted-2)]">Prefer “Send password reset link” for best auditability.</div>
                      <div className="flex flex-wrap gap-2 pt-2">
                        <Button type="button" onClick={() => void saveEdit()} disabled={savingEdit}>
                          {savingEdit ? "Saving…" : "Save changes"}
                        </Button>
                        <Button
                          type="button"
                          className="border border-white/15 bg-white/5 text-white hover:bg-white/10"
                          onClick={async () => {
                            try {
                              const token = getAccessToken();
                              const tokenRole = getTokenRole(token);
                              if (!token) throw new Error("Please login first.");
                              if (tokenRole !== "admin") throw new Error("Insufficient permissions.");
                              if (!editUserId) throw new Error("No user selected.");
                              await apiFetch(`/admin/users/${encodeURIComponent(editUserId)}/send-password-reset`, {
                                method: "POST",
                                token,
                                retries: 4,
                                retryOn404: true
                              });
                              toast({ kind: "success", title: "Sent", message: "Password reset link requested." });
                            } catch (err) {
                              const parsed = parseApiError(err);
                              toast({ kind: "error", title: "Failed", message: parsed.formError ?? "Failed to send reset link." });
                            }
                          }}
                          disabled={savingEdit}
                        >
                          Send password reset link
                        </Button>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </Card>
          </div>
        </div>
      ) : null}

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


