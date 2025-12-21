"use client";

import { useEffect, useMemo, useState } from "react";

import { useConfirm } from "@/components/ConfirmDialog";
import { Button, Card } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { getAccessToken, getTokenRole } from "@/lib/auth";

type Row = {
  _id: string;
  type: string;
  title: string;
  message: string;
  href?: string;
  createdAt?: string;
  readAt?: string;
  user?: { id?: string; email?: string; role?: string };
};

export function AdminNotificationQueue() {
  const confirm = useConfirm();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<Row[]>([]);
  const [unreadOnly, setUnreadOnly] = useState(true);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    params.set("limit", "100");
    if (unreadOnly) params.set("unreadOnly", "1");
    return params.toString();
  }, [unreadOnly]);

  async function load() {
    setError(null);
    setLoading(true);
    try {
      const token = getAccessToken();
      const role = getTokenRole(token);
      if (!token) throw new Error("Please login first.");
      if (role !== "admin") throw new Error("Insufficient permissions.");
      const res = await apiFetch<{ results: Row[] }>(`/admin/notifications?${query}`, { token });
      setResults(res.results);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load notification queue");
    } finally {
      setLoading(false);
    }
  }

  async function remove(id: string) {
    const ok = await confirm({
      title: "Delete notification?",
      message: "Remove this notification from the queue? This cannot be undone.",
      confirmText: "Delete",
      cancelText: "Cancel",
      destructive: true
    });
    if (!ok) return;

    setError(null);
    try {
      const token = getAccessToken();
      const role = getTokenRole(token);
      if (!token) throw new Error("Please login first.");
      if (role !== "admin") throw new Error("Insufficient permissions.");
      await apiFetch(`/admin/notifications/${id}`, { method: "DELETE", token });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete notification");
    }
  }

  async function deleteAll() {
    const ok = await confirm({
      title: unreadOnly ? "Delete all unread notifications?" : "Delete all notifications?",
      message: unreadOnly
        ? "Delete all unread notifications from the queue? This cannot be undone."
        : "Delete all notifications from the queue? This cannot be undone.",
      confirmText: "Delete all",
      cancelText: "Cancel",
      destructive: true
    });
    if (!ok) return;

    setError(null);
    try {
      const token = getAccessToken();
      const role = getTokenRole(token);
      if (!token) throw new Error("Please login first.");
      if (role !== "admin") throw new Error("Insufficient permissions.");
      const qs = unreadOnly ? "?unreadOnly=1" : "";
      await apiFetch<{ deletedCount: number }>(`/admin/notifications${qs}`, { method: "DELETE", token });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete all");
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Notification queue</h2>
          <p className="mt-1 text-sm text-[color:var(--muted)]">Admin view of recent notifications across all users.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setUnreadOnly((p) => !p)}
            className="rounded-md border border-[color:var(--border)] bg-[var(--surface-soft)] px-3 py-1.5 text-sm text-[color:var(--foreground)] hover:bg-[var(--surface)]"
          >
            {unreadOnly ? "Showing: Unread" : "Showing: All"}
          </button>
            <Button
              type="button"
              className="border border-white/15 bg-white/5 text-white hover:bg-white/10"
              onClick={deleteAll}
              disabled={loading || results.length === 0}
            >
              Delete all
            </Button>
          <Button type="button" onClick={load} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </Button>
        </div>
      </div>

      {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}

      <div className="mt-6 grid gap-3">
        {results.map((n) => (
          <div key={n._id} className="rounded-2xl border border-[color:var(--border)] bg-[var(--surface)] p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="font-semibold">{n.title}</div>
                <div className="mt-1 text-sm text-[color:var(--muted)]">{n.message}</div>
                <div className="mt-2 text-xs text-[color:var(--muted-2)]">
                  {n.user?.email ? `${n.user.email} (${n.user.role ?? "?"})` : "Unknown user"}
                  {n.type ? ` · ${n.type}` : ""}
                  {n.createdAt ? ` · ${new Date(n.createdAt).toLocaleString()}` : ""}
                  {n.readAt ? ` · read` : " · unread"}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {n.href ? (
                  <a className="text-sm text-indigo-300 hover:text-indigo-200 hover:underline" href={n.href}>
                    Open
                  </a>
                ) : null}
                <Button type="button" onClick={() => remove(n._id)}>
                  Delete
                </Button>
              </div>
            </div>
          </div>
        ))}
        {results.length === 0 && !error ? <p className="text-sm text-[color:var(--muted)]">No notifications.</p> : null}
      </div>
    </Card>
  );
}


