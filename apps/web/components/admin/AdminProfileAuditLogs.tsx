"use client";

import * as React from "react";

import { Card, Button } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { getAccessToken } from "@/lib/auth";

type AuditLogItem = {
  _id: string;
  actorUserId: string;
  targetUserId: string;
  action: string;
  entityType: string;
  before?: any;
  after?: any;
  ip?: string;
  userAgent?: string;
  createdAt: string;
};

export function AdminProfileAuditLogs() {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [items, setItems] = React.useState<AuditLogItem[]>([]);
  const [action, setAction] = React.useState<string>("PROFILE_VISIBILITY_CHANGED");
  const [limit, setLimit] = React.useState(50);

  async function load() {
    setError(null);
    setLoading(true);
    try {
      const token = getAccessToken();
      if (!token) throw new Error("Please login as an admin first.");
      const qs = new URLSearchParams();
      if (action) qs.set("action", action);
      qs.set("limit", String(limit));
      const res = await apiFetch<{ items: AuditLogItem[] }>(`/admin/audit-logs?${qs.toString()}`, { token });
      setItems(res.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load audit logs");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action, limit]);

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Profile audit logs</h1>
          <p className="mt-2 text-sm text-white/80">Visibility and profile changes (admin only).</p>
        </div>
        <Button type="button" className="border border-white/15 bg-white/5 text-white hover:bg-white/10" onClick={load} disabled={loading}>
          {loading ? "Refreshing…" : "Refresh"}
        </Button>
      </div>

      {error ? <div className="mt-4 text-sm text-red-300">{error}</div> : null}

      <div className="mt-6 flex flex-wrap items-center gap-3 text-sm text-white/80">
        <label className="flex items-center gap-2">
          <span className="text-white/70">Action</span>
          <select
            className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            value={action}
            onChange={(e) => setAction(e.target.value)}
          >
            <option value="PROFILE_VISIBILITY_CHANGED">PROFILE_VISIBILITY_CHANGED</option>
            <option value="PROFILE_UPDATED">PROFILE_UPDATED</option>
          </select>
        </label>
        <label className="flex items-center gap-2">
          <span className="text-white/70">Limit</span>
          <select
            className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            value={String(limit)}
            onChange={(e) => setLimit(Number(e.target.value))}
          >
            <option value="25">25</option>
            <option value="50">50</option>
            <option value="100">100</option>
            <option value="200">200</option>
          </select>
        </label>
      </div>

      <div className="mt-6 overflow-auto rounded-xl border border-white/10">
        <table className="min-w-[900px] w-full text-left text-sm">
          <thead className="bg-white/5 text-xs uppercase tracking-wide text-white/60">
            <tr>
              <th className="px-4 py-3">Time</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Entity</th>
              <th className="px-4 py-3">Actor</th>
              <th className="px-4 py-3">Target</th>
              <th className="px-4 py-3">Change</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => {
              const change =
                it.action === "PROFILE_VISIBILITY_CHANGED"
                  ? `${String(it.before?.isProfilePublic)} → ${String(it.after?.isProfilePublic)}`
                  : "";
              return (
                <tr key={it._id} className="border-t border-white/10">
                  <td className="px-4 py-3 whitespace-nowrap text-white/80">{new Date(it.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-3 text-white/80">{it.action}</td>
                  <td className="px-4 py-3 text-white/70">{it.entityType}</td>
                  <td className="px-4 py-3 font-mono text-xs text-white/70">{it.actorUserId}</td>
                  <td className="px-4 py-3 font-mono text-xs text-white/70">{it.targetUserId}</td>
                  <td className="px-4 py-3 text-white/80">{change || "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}


