"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { Card, RefreshIconButton } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { getAccessToken, getTokenRole } from "@/lib/auth";

type Trends = {
  weeks: string[];
  series: Record<string, Array<number | null>>;
  note?: string;
};

function money(cents: number | null | undefined) {
  if (typeof cents !== "number") return "—";
  const amt = cents / 100;
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(amt);
  } catch {
    return `$${amt.toFixed(2)}`;
  }
}

function Sparkline(props: { values: Array<number | null> }) {
  const vals = props.values.filter((v) => typeof v === "number" && Number.isFinite(v)) as number[];
  if (vals.length < 2) return <div className="h-8" />;
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const w = 220;
  const h = 36;
  const pts = props.values
    .map((v, i) => {
      const x = (i / Math.max(1, props.values.length - 1)) * (w - 2) + 1;
      if (v == null || !Number.isFinite(v)) return `${x},${h / 2}`;
      const t = max === min ? 0.5 : (Number(v) - min) / (max - min);
      const y = (1 - t) * (h - 2) + 1;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden>
      <polyline fill="none" stroke="rgba(99,102,241,0.9)" strokeWidth="2" points={pts} />
    </svg>
  );
}

export function AdminMetricsTrendsClient() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [weeks, setWeeks] = useState(12);
  const [data, setData] = useState<Trends | null>(null);

  const qs = useMemo(() => `weeks=${weeks}`, [weeks]);

  async function load() {
    setError(null);
    setLoading(true);
    try {
      const token = getAccessToken();
      const role = getTokenRole(token);
      if (!token) throw new Error("Please login first.");
      if (role !== "admin") throw new Error("Insufficient permissions.");
      const res = await apiFetch<Trends>(`/admin/metrics/trends?${qs}`, { token, retries: 2, retryOn404: true });
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load trends");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weeks]);

  const s = data?.series ?? {};

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Metrics trends</h1>
          <p className="mt-2 text-sm text-white/80">Weekly trends built from daily snapshots.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="rounded-md border border-white/15 bg-white/5 px-3 py-2 text-sm text-white"
            value={weeks}
            onChange={(e) => setWeeks(Number(e.target.value))}
          >
            <option value={12}>12 weeks</option>
            <option value={24}>24 weeks</option>
            <option value={52}>52 weeks</option>
          </select>
          <RefreshIconButton onClick={load} loading={loading} title="Refresh trends" />
          <Link href="/admin/metrics" className="text-sm text-indigo-300 hover:text-indigo-200 hover:underline">
            Back to metrics
          </Link>
        </div>
      </div>

      {error ? (
        <Card>
          <div className="text-sm text-red-300">{error}</div>
        </Card>
      ) : null}

      {data ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <div className="text-sm font-semibold">MRR (cents)</div>
            <div className="mt-1 text-sm text-white/70">Latest: {money(s.mrrCents?.[s.mrrCents.length - 1] ?? null)}</div>
            <div className="mt-3">
              <Sparkline values={s.mrrCents ?? []} />
            </div>
          </Card>
          <Card>
            <div className="text-sm font-semibold">Backlog (open)</div>
            <div className="mt-3">
              <Sparkline values={s.backlogOpen ?? []} />
            </div>
          </Card>
          <Card>
            <div className="text-sm font-semibold">Overdue (open)</div>
            <div className="mt-3">
              <Sparkline values={s.overdueOpen ?? []} />
            </div>
          </Card>
          <Card>
            <div className="text-sm font-semibold">Submissions (weekly)</div>
            <div className="mt-3">
              <Sparkline values={s.submissionsNew ?? []} />
            </div>
          </Card>
          <Card>
            <div className="text-sm font-semibold">Evaluations completed (weekly)</div>
            <div className="mt-3">
              <Sparkline values={s.evaluationsCompletedNew ?? []} />
            </div>
          </Card>
          <Card>
            <div className="text-sm font-semibold">Email fail rate (%)</div>
            <div className="mt-3">
              <Sparkline values={s.emailFailRatePct ?? []} />
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}


