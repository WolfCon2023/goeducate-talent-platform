"use client";

import { useState } from "react";

import { apiFetch } from "@/lib/api";
import { getAccessToken, getTokenRole } from "@/lib/auth";
import { Card, Button } from "@/components/ui";
import { useAutoRevalidate } from "@/lib/useAutoRevalidate";

type AuditRow = {
  _id: string;
  createdAt: string;
  action: string;
  targetType?: string;
  targetId?: string;
  ip?: string;
  meta?: any;
  actor?: { id?: string; email?: string; role?: string } | null;
};

export function AdminAuditLog() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(0);
  const pageSize = 50;

  async function load() {
    setError(null);
    setLoading(true);
    try {
      const token = getAccessToken();
      const role = getTokenRole(token);
      if (!token) throw new Error("Please login first.");
      if (role !== "admin") throw new Error("Insufficient permissions.");

      const res = await apiFetch<{ total: number; results: AuditRow[] }>(`/admin/audit?limit=${pageSize}&skip=${page * pageSize}`, { token });
      setRows(res.results ?? []);
      setTotal(res.total ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load audit log");
    } finally {
      setLoading(false);
    }
  }

  useAutoRevalidate(load, { deps: [page], intervalMs: 30_000 });

  return (
    <Card>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Admin audit log</h2>
          <p className="mt-1 text-sm text-[color:var(--muted)]">Track who changed what (admin actions).</p>
        </div>
        <Button type="button" onClick={load} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh"}
        </Button>
      </div>

      {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}

      <div className="mt-4 flex items-center justify-between gap-3 text-sm text-[color:var(--muted)]">
        <div>
          Showing <span className="text-[color:var(--foreground)] font-semibold">{rows.length}</span> of{" "}
          <span className="text-[color:var(--foreground)] font-semibold">{total}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-md border border-white/10 bg-white/5 px-3 py-1 text-sm text-white/90 hover:bg-white/10 disabled:opacity-50"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0 || loading}
          >
            Prev
          </button>
          <button
            type="button"
            className="rounded-md border border-white/10 bg-white/5 px-3 py-1 text-sm text-white/90 hover:bg-white/10 disabled:opacity-50"
            onClick={() => setPage((p) => (p + 1) * pageSize < total ? p + 1 : p)}
            disabled={(page + 1) * pageSize >= total || loading}
          >
            Next
          </button>
        </div>
      </div>

      <div className="mt-3 max-h-[520px] overflow-auto rounded-xl border border-white/10">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 bg-[var(--surface)] text-xs uppercase tracking-wide text-[color:var(--muted-2)]">
            <tr>
              <th className="px-3 py-2">Time</th>
              <th className="px-3 py-2">Actor</th>
              <th className="px-3 py-2">Action</th>
              <th className="px-3 py-2">Target</th>
              <th className="px-3 py-2">Meta</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r._id} className="border-t border-white/10">
                <td className="px-3 py-2 whitespace-nowrap">{new Date(r.createdAt).toLocaleString()}</td>
                <td className="px-3 py-2">{r.actor?.email ?? "—"}</td>
                <td className="px-3 py-2 text-[color:var(--foreground)]">{r.action}</td>
                <td className="px-3 py-2">
                  {r.targetType ? `${r.targetType}${r.targetId ? `:${r.targetId}` : ""}` : "—"}
                </td>
                <td className="px-3 py-2 text-xs text-[color:var(--muted)]">
                  {r.meta ? (typeof r.meta === "string" ? r.meta : JSON.stringify(r.meta)) : "—"}
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td className="px-3 py-3 text-[color:var(--muted)]" colSpan={5}>
                  No audit log entries found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </Card>
  );
}


