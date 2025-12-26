"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { Card, RefreshIconButton } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { getAccessToken, getTokenRole } from "@/lib/auth";

type FunnelUser = {
  id: string;
  email: string;
  displayName: string | null;
  subscriptionStatus: string | null;
  createdAt: string | null;
};

type FunnelRes = { stage: string; days: number; total: number; users: FunnelUser[] };

export function FunnelClient() {
  const sp = useSearchParams();
  const stage = (sp.get("stage") ?? "searched").trim();
  const days = Number(sp.get("days") ?? "30") || 30;
  const qs = useMemo(() => `stage=${encodeURIComponent(stage)}&days=${encodeURIComponent(String(days))}`, [stage, days]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<FunnelRes | null>(null);

  async function load() {
    setError(null);
    setLoading(true);
    try {
      const token = getAccessToken();
      const role = getTokenRole(token);
      if (!token) throw new Error("Please login first.");
      if (role !== "admin") throw new Error("Insufficient permissions.");
      const res = await apiFetch<FunnelRes>(`/admin/metrics/drilldown/funnel?${qs}`, { token, retries: 2, retryOn404: true });
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load funnel drilldown");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qs]);

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-2xl font-semibold tracking-tight">Coach funnel drilldown</div>
          <div className="mt-2 text-sm text-white/70">
            Stage: <span className="text-white">{stage}</span> · Window: <span className="text-white">{days}d</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/admin/metrics" className="text-sm text-indigo-300 hover:text-indigo-200 hover:underline">
            Back to metrics
          </Link>
          <RefreshIconButton onClick={load} loading={loading} title="Refresh" />
        </div>
      </div>

      {error ? <div className="text-sm text-red-300">{error}</div> : null}

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-white/80">
            Showing <span className="font-semibold text-white">{data?.users?.length ?? 0}</span> coaches (max 500).
          </div>
          <div className="text-xs text-white/60">Tip: change stage via `?stage=searched|watchlist|contact|checkout|activated`.</div>
        </div>

        <div className="mt-4 overflow-x-auto rounded-2xl border border-white/10">
          <table className="min-w-full border-collapse text-sm">
            <thead className="bg-white/5 text-left text-white/70">
              <tr>
                <th className="px-4 py-3 font-semibold">Coach</th>
                <th className="px-4 py-3 font-semibold">Subscription</th>
                <th className="px-4 py-3 font-semibold">Created</th>
                <th className="px-4 py-3 font-semibold">Open</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {(data?.users ?? []).map((u) => (
                <tr key={u.id}>
                  <td className="px-4 py-3 text-white/80">{u.displayName ?? u.email}</td>
                  <td className="px-4 py-3 text-white/70">{u.subscriptionStatus ?? "—"}</td>
                  <td className="px-4 py-3 text-white/70">{u.createdAt ? new Date(u.createdAt).toLocaleString() : "—"}</td>
                  <td className="px-4 py-3">
                    <Link href={`/admin/users?prefill=${encodeURIComponent(u.id)}`} className="text-indigo-300 hover:text-indigo-200 hover:underline">
                      User →
                    </Link>
                  </td>
                </tr>
              ))}
              {(data?.users ?? []).length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-white/70" colSpan={4}>
                    No results.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}


