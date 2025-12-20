"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to mark read");
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
        <Button type="button" onClick={load} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh"}
        </Button>
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


