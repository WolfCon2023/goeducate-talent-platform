"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { Button, Card } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { getAccessToken } from "@/lib/auth";

type NotificationRow = {
  _id: string;
  type?: string;
  title?: string;
  message?: string;
  href?: string;
  readAt?: string;
  createdAt?: string;
};

function fmt(iso?: string) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function NotificationsPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [unreadOnly, setUnreadOnly] = useState(false);

  async function load() {
    setError(null);
    setLoading(true);
    try {
      const token = getAccessToken();
      if (!token) throw new Error("Please login first.");
      const qs = new URLSearchParams();
      if (unreadOnly) qs.set("unreadOnly", "1");
      qs.set("limit", "200");
      const res = await apiFetch<{ results: NotificationRow[] }>(`/notifications/me?${qs.toString()}`, { token });
      setItems(res.results ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load notifications");
    } finally {
      setLoading(false);
    }
  }

  async function markRead(id: string) {
    try {
      const token = getAccessToken();
      if (!token) throw new Error("Please login first.");
      await apiFetch(`/notifications/${encodeURIComponent(id)}/read`, { method: "PATCH", token });
      window.dispatchEvent(new Event("goeducate:notifications-changed"));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to mark read");
    }
  }

  async function clearAll() {
    try {
      const token = getAccessToken();
      if (!token) throw new Error("Please login first.");
      const qs = unreadOnly ? "?unreadOnly=1" : "";
      await apiFetch(`/notifications/me${qs}`, { method: "DELETE", token });
      window.dispatchEvent(new Event("goeducate:notifications-changed"));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to clear notifications");
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unreadOnly]);

  const empty = useMemo(() => !loading && !error && items.length === 0, [loading, error, items.length]);

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>
          <p className="mt-2 text-sm text-white/80">Updates about evaluations, film status, and other activity.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            className="border border-white/15 bg-white/5 text-white hover:bg-white/10"
            onClick={() => setUnreadOnly((v) => !v)}
          >
            {unreadOnly ? "Showing unread" : "Showing all"}
          </Button>
          <Button type="button" onClick={() => void load()} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </Button>
          <Button type="button" className="bg-red-600 hover:bg-red-500" onClick={() => void clearAll()} disabled={loading}>
            Clear
          </Button>
          <Link href="/" className="text-sm text-indigo-300 hover:text-indigo-200 hover:underline">
            Home
          </Link>
        </div>
      </div>

      {error ? (
        <Card>
          <div className="text-sm text-red-300">{error}</div>
        </Card>
      ) : null}

      {empty ? (
        <Card>
          <div className="text-sm text-white/80">No notifications.</div>
        </Card>
      ) : null}

      {items.length ? (
        <div className="grid gap-3">
          {items.map((n) => {
            const read = Boolean(n.readAt);
            return (
              <div key={n._id} className={`rounded-2xl border p-4 ${read ? "border-white/10 bg-white/5" : "border-indigo-400/25 bg-indigo-500/10"}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-white">{n.title ?? "Notification"}</div>
                    {n.message ? <div className="mt-1 text-sm text-white/80">{n.message}</div> : null}
                    <div className="mt-2 text-xs text-white/60">
                      {fmt(n.createdAt)} {n.type ? `· ${n.type}` : ""}
                    </div>
                    {n.href ? (
                      <div className="mt-2">
                        <Link href={n.href} className="text-sm text-indigo-300 hover:text-indigo-200 hover:underline">
                          Open
                        </Link>
                      </div>
                    ) : null}
                  </div>
                  {!read ? (
                    <Button type="button" className="border border-white/15 bg-white/5 text-white hover:bg-white/10" onClick={() => void markRead(n._id)}>
                      Mark read
                    </Button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}


