"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { useConfirm } from "@/components/ConfirmDialog";
import { Button, Card } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { getAccessToken } from "@/lib/auth";

type Notification = {
  _id: string;
  title: string;
  message: string;
  href?: string;
  readAt?: string;
  createdAt?: string;
};

export function NotificationsCenter() {
  const confirm = useConfirm();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<Notification[]>([]);

  async function load() {
    setError(null);
    setLoading(true);
    try {
      const token = getAccessToken();
      if (!token) throw new Error("Please login first.");
      const res = await apiFetch<{ results: Notification[] }>("/notifications/me?limit=100", { token });
      setResults(res.results);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load notifications");
    } finally {
      setLoading(false);
    }
  }

  async function markRead(id: string) {
    try {
      const token = getAccessToken();
      if (!token) throw new Error("Please login first.");
      await apiFetch(`/notifications/${id}/read`, { method: "PATCH", token });
      await load();
      window.dispatchEvent(new Event("goeducate:notifications-changed"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to mark read");
    }
  }

  async function remove(id: string) {
    const ok = await confirm({
      title: "Delete notification?",
      message: "Delete this notification? This cannot be undone.",
      confirmText: "Delete",
      cancelText: "Cancel",
      destructive: true
    });
    if (!ok) return;

    try {
      const token = getAccessToken();
      if (!token) throw new Error("Please login first.");
      await apiFetch(`/notifications/${id}`, { method: "DELETE", token });
      await load();
      window.dispatchEvent(new Event("goeducate:notifications-changed"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    }
  }

  async function deleteAll() {
    const ok = await confirm({
      title: "Delete all notifications?",
      message: "Delete all notifications in your queue? This cannot be undone.",
      confirmText: "Delete all",
      cancelText: "Cancel",
      destructive: true
    });
    if (!ok) return;

    try {
      const token = getAccessToken();
      if (!token) throw new Error("Please login first.");
      await apiFetch<{ deletedCount: number }>(`/notifications/me`, { method: "DELETE", token });
      await load();
      window.dispatchEvent(new Event("goeducate:notifications-changed"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete all");
    }
  }

  async function markAllRead() {
    try {
      const token = getAccessToken();
      if (!token) throw new Error("Please login first.");
      await apiFetch<{ modifiedCount: number }>(`/notifications/me/read?unreadOnly=1`, { method: "PATCH", token });
      await load();
      window.dispatchEvent(new Event("goeducate:notifications-changed"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to mark all read");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <Card>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>
          <p className="mt-1 text-sm text-[color:var(--muted)]">Film submissions, evaluations, and watchlist updates.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            className="border border-white/15 bg-white/5 text-white hover:bg-white/10"
            onClick={markAllRead}
            disabled={loading || results.length === 0}
          >
            Mark all read
          </Button>
          <Button type="button" className="border border-white/15 bg-white/5 text-white hover:bg-white/10" onClick={deleteAll} disabled={loading || results.length === 0}>
            Delete all
          </Button>
          <Button type="button" onClick={load} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </Button>
        </div>
      </div>

      {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}

      <div className="mt-6 grid gap-3">
        {results.map((n) => {
          const unread = !n.readAt;
          return (
            <div
              key={n._id}
              className={`rounded-2xl border border-[color:var(--border)] p-4 ${unread ? "bg-[var(--surface-soft)]" : "bg-[var(--surface)]"}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="font-semibold">{n.title}</div>
                    {unread ? (
                      <span className="rounded-full border border-[color:var(--border)] bg-[var(--surface)] px-2 py-0.5 text-xs font-semibold text-[color:var(--muted-2)]">
                        New
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1 text-sm text-[color:var(--muted)]">{n.message}</div>
                  {n.createdAt ? (
                    <div className="mt-2 text-xs text-[color:var(--muted-2)]">{new Date(n.createdAt).toLocaleString()}</div>
                  ) : null}
                </div>

                <div className="flex items-center gap-2">
                  {n.href ? (
                    <Link
                      href={n.href}
                      onClick={() => {
                        if (unread) void markRead(n._id);
                      }}
                      className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
                    >
                      Open
                    </Link>
                  ) : null}
                  {unread ? (
                    <Button type="button" onClick={() => markRead(n._id)}>
                      Mark read
                    </Button>
                  ) : null}
                  <Button type="button" className="border border-white/15 bg-white/5 text-white hover:bg-white/10" onClick={() => remove(n._id)}>
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
        {results.length === 0 ? <p className="text-sm text-[color:var(--muted)]">No notifications yet.</p> : null}
      </div>
    </Card>
  );
}


