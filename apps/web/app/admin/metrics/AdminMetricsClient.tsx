"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { Card, RefreshIconButton } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { getAccessToken, getTokenRole } from "@/lib/auth";
import { HelpIcon } from "@/components/kb/HelpIcon";
import { useAutoRevalidate } from "@/lib/useAutoRevalidate";

type Metrics = {
  timeframe: { days: number; start: string; end: string };
  users: {
    totalsByRole: Record<string, number>;
    newUsersByRole: Record<string, number>;
    coaches: {
      total: number;
      active: number;
      conversionRatePct: number | null;
      new: number;
      newActive: number;
      newConversionRatePct: number | null;
    };
    active: { dauByRole: Record<string, number>; wauByRole: Record<string, number>; mauByRole: Record<string, number> };
    profiles: {
      playerPublicRatePct: number | null;
      playerCompletion: { avgScore: number | null; pctAtLeast80: number | null; count: number };
      coachCompletion: { avgScore: number | null; pctAtLeast80: number | null; count: number };
      evaluatorCompletion: { avgScore: number | null; pctAtLeast80: number | null; count: number };
    };
  };
  evaluations: {
    submissions: { total: number; new: number; byStatus: Record<string, number>; backlogOpen: number; overdueHours: number; overdueCount: number };
    reports: { total: number; completedNew: number };
    turnaround: { avgHours: number | null; medianHours: number | null; p90Hours: number | null; sampleSize: number };
    evaluatorThroughput: Array<{
      evaluatorUserId: string | null;
      evaluatorName: string | null;
      evaluatorEmail: string | null;
      count: number;
      avgGrade: number | null;
      stddev: number | null;
    }>;
  };
  engagement: {
    coachSearch: { total: number; uniqueCoaches: number };
    watchlist: { totalItems: number; addsNew: number };
    contactRequests: { total: number };
    messages: { sent: number };
    evaluationViews: { coachOpens: number };
    coachFunnel?: { searched: number; watchlistAdded: number; contactRequested: number; checkoutStarted: number; activated: number };
  };
  revenue: {
    stripe: any;
    showcases: Array<{ currency: string; paidCount: number; revenueCents: number }>;
  };
  reliability: {
    email: { totals: { sent: number; failed: number; skipped: number }; failRatePct: number | null; byType: Record<string, { sent: number; failed: number; skipped: number }> };
    kb: {
      topViewed: Array<{ slug: string; views: number }>;
      feedback: { yes: number; no: number; total: number };
      mostNotHelpful: Array<{ slug: string; title: string; helpfulNoCount: number; helpfulYesCount: number }>;
    };
    authRecovery: { usernameReminderEmails: number; passwordResetEmails: number };
  };
  config?: any;
  statusFlags?: Record<string, string>;
  alerts?: Array<{ id: string; level: "red" | "yellow" | "info"; title: string; message: string; href?: string }>;
  deltas?: Record<string, number | null>;
  dataQuality?: {
    appEventsLast14Days: Array<{ day: string; count: number }>;
    dailyActiveRowsLast14Days: Array<{ day: string; count: number }>;
    snapshotsLast14Days: Array<{ day: string; count: number }>;
    lastStripeWebhookAt: string | null;
    appEventSchemaVersion: number;
  };
  ops?: {
    overdueHours: number;
    overdueItems: Array<{
      id: string;
      title: string;
      status: string;
      createdAt: string | null;
      assignedAt: string | null;
      assignedEvaluator: { id: string; email: string | null } | null;
      playerName: string | null;
      playerSport: string | null;
      playerPosition: string | null;
    }>;
    evaluatorWorkload: Array<{
      evaluatorUserId: string;
      evaluatorEmail: string | null;
      evaluatorName: string | null;
      openAssigned: number;
      overdueAssigned: number;
      oldestAgeHours: number | null;
      newestAssignedAt: string | null;
      completedInWindow: number;
    }>;
  };
};

type Trends = {
  weeks: string[];
  series: Record<string, Array<number | null>>;
  note?: string;
};

function money(cents: number, currency: string) {
  const amt = (cents ?? 0) / 100;
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: (currency || "usd").toUpperCase() }).format(amt);
  } catch {
    return `$${amt.toFixed(2)}`;
  }
}

function pct(v: number | null | undefined) {
  return v == null ? "—" : `${v}%`;
}

export function AdminMetricsClient() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState<30 | 7 | 90>(30);
  const [data, setData] = useState<Metrics | null>(null);
  const [trends, setTrends] = useState<Trends | null>(null);
  const [config, setConfig] = useState<any | null>(null);
  const [configOpen, setConfigOpen] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [snapshotEmailOpen, setSnapshotEmailOpen] = useState(false);
  const [snapshotEmailTo, setSnapshotEmailTo] = useState("");
  const [sendingSnapshotEmail, setSendingSnapshotEmail] = useState(false);

  const qs = useMemo(() => `days=${days}`, [days]);

  async function load() {
    setError(null);
    setLoading(true);
    try {
      const token = getAccessToken();
      const role = getTokenRole(token);
      if (!token) throw new Error("Please login first.");
      if (role !== "admin") throw new Error("Insufficient permissions.");
      const [res, t, cfg] = await Promise.all([
        apiFetch<Metrics>(`/admin/metrics/summary?${qs}`, { token, retries: 2, retryOn404: true }),
        apiFetch<Trends>(`/admin/metrics/trends?weeks=12`, { token, retries: 2, retryOn404: true }).catch(() => null as any),
        apiFetch<{ config: any }>(`/admin/metrics/config`, { token, retries: 2, retryOn404: true }).catch(() => null as any)
      ]);
      setData(res);
      setTrends(t ?? null);
      setConfig(cfg?.config ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load metrics");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days]);

  // Auto refresh + event-driven refresh (reduces manual Refresh usage)
  useAutoRevalidate(load, { intervalMs: 60_000, deps: [days] });
  useEffect(() => {
    const onEvalChanged = () => void load();
    const onEmailChanged = () => void load();
    window.addEventListener("goeducate:evaluations-changed", onEvalChanged);
    window.addEventListener("goeducate:email-changed", onEmailChanged);
    return () => {
      window.removeEventListener("goeducate:evaluations-changed", onEvalChanged);
      window.removeEventListener("goeducate:email-changed", onEmailChanged);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days]);

  const stripe = data?.revenue.stripe;
  const stripeConfigured = Boolean(stripe?.configured);

  function seriesFor(key: string) {
    return (trends?.series?.[key] ?? []) as Array<number | null>;
  }

  function Sparkline(props: { values: Array<number | null>; className?: string }) {
    const vals = props.values.filter((v) => typeof v === "number" && Number.isFinite(v)) as number[];
    if (vals.length < 2) return <div className={props.className ?? "h-8"} />;
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const w = 120;
    const h = 28;
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
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className={props.className ?? ""} aria-hidden>
        <polyline fill="none" stroke="rgba(99,102,241,0.9)" strokeWidth="2" points={pts} />
      </svg>
    );
  }

  async function saveConfig(next: any) {
    try {
      setSavingConfig(true);
      const token = getAccessToken();
      const role = getTokenRole(token);
      if (!token) throw new Error("Please login first.");
      if (role !== "admin") throw new Error("Insufficient permissions.");
      const res = await apiFetch<{ config: any }>(`/admin/metrics/config`, { method: "PUT", token, body: JSON.stringify(next), retries: 2, retryOn404: true });
      setConfig(res.config);
      setConfigOpen(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save config");
    } finally {
      setSavingConfig(false);
    }
  }

  async function sendSnapshotEmail() {
    try {
      setSendingSnapshotEmail(true);
      const token = getAccessToken();
      const role = getTokenRole(token);
      if (!token) throw new Error("Please login first.");
      if (role !== "admin") throw new Error("Insufficient permissions.");
      await apiFetch("/admin/metrics/email-snapshot", {
        method: "POST",
        token,
        body: JSON.stringify({ to: snapshotEmailTo, days }),
        retries: 3,
        retryOn404: true
      });
      setSnapshotEmailOpen(false);
      setSnapshotEmailTo("");
    } catch (e) {
      // Railway sometimes has a brief mixed-deploy window; a transient 404 is recoverable.
      setError(e instanceof Error ? e.message : "Failed to send email");
    } finally {
      setSendingSnapshotEmail(false);
    }
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">Metrics</h1>
            <HelpIcon helpKey="admin.metrics" title="Admin metrics" />
          </div>
          <p className="mt-2 text-sm text-white/80">Executive snapshot + operational KPIs (auto-updating as activity is tracked).</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setDays(7)}
            className={`rounded-md px-3 py-1.5 text-sm ${days === 7 ? "bg-indigo-600 text-white" : "border border-white/15 bg-white/5 text-white hover:bg-white/10"}`}
          >
            7d
          </button>
          <button
            type="button"
            onClick={() => setDays(30)}
            className={`rounded-md px-3 py-1.5 text-sm ${days === 30 ? "bg-indigo-600 text-white" : "border border-white/15 bg-white/5 text-white hover:bg-white/10"}`}
          >
            30d
          </button>
          <button
            type="button"
            onClick={() => setDays(90)}
            className={`rounded-md px-3 py-1.5 text-sm ${days === 90 ? "bg-indigo-600 text-white" : "border border-white/15 bg-white/5 text-white hover:bg-white/10"}`}
          >
            90d
          </button>
          <RefreshIconButton onClick={load} loading={loading} title="Refresh metrics" />
          <Link
            href="/admin/metrics/trends"
            className="rounded-md border border-white/15 bg-white/5 px-3 py-1.5 text-sm text-white hover:bg-white/10"
          >
            Trends
          </Link>
          <button
            type="button"
            onClick={() => setSnapshotEmailOpen(true)}
            className="rounded-md border border-white/15 bg-white/5 px-3 py-1.5 text-sm text-white hover:bg-white/10"
          >
            Email snapshot
          </button>
          <button
            type="button"
            onClick={() => setConfigOpen(true)}
            className="rounded-md border border-white/15 bg-white/5 px-3 py-1.5 text-sm text-white hover:bg-white/10"
          >
            Targets
          </button>
          <Link href="/admin" className="text-sm text-indigo-300 hover:text-indigo-200 hover:underline">
            Back to admin
          </Link>
        </div>
      </div>

      {error ? (
        <Card>
          <div className="text-sm text-red-300">{error}</div>
        </Card>
      ) : null}

      {data ? (
        <>
          <div className="grid gap-4 lg:grid-cols-4">
            <Card>
              <div className="text-xs uppercase tracking-wide text-white/60">MRR (Stripe)</div>
              <div className="mt-1 text-2xl font-semibold">{stripeConfigured && typeof stripe?.mrrCents === "number" ? money(stripe.mrrCents, "usd") : "—"}</div>
              <div className="mt-2 text-sm text-white/70">
                active: {stripe?.active ?? "—"} · monthly: {stripe?.monthly ?? "—"} · annual: {stripe?.annual ?? "—"}
              </div>
              <div className="mt-2">
                <Sparkline values={seriesFor("mrrCents")} />
              </div>
            </Card>
            <Card>
              <div className="text-xs uppercase tracking-wide text-white/60">Submissions (new)</div>
              <div className="mt-1 text-2xl font-semibold">{data.evaluations.submissions.new}</div>
              <div className="mt-2 text-sm text-white/70">backlog: {data.evaluations.submissions.backlogOpen} · overdue: {data.evaluations.submissions.overdueCount}</div>
              <div className="mt-2">
                <Sparkline values={seriesFor("submissionsNew")} />
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-sm">
                <Link href="/admin/evaluations" className="text-indigo-300 hover:text-indigo-200 hover:underline">
                  Open queue →
                </Link>
                <Link href="/admin/evaluations?hasEval=0" className="text-indigo-300 hover:text-indigo-200 hover:underline">
                  No report →
                </Link>
                <Link href="/admin/evaluations?hasAssigned=0" className="text-indigo-300 hover:text-indigo-200 hover:underline">
                  Unassigned →
                </Link>
              </div>
            </Card>
            <Card>
              <div className="text-xs uppercase tracking-wide text-white/60">Evaluations (completed)</div>
              <div className="mt-1 text-2xl font-semibold">{data.evaluations.reports.completedNew}</div>
              <div className="mt-2 text-sm text-white/70">
                TAT avg: {data.evaluations.turnaround.avgHours ?? "—"}h · p90: {data.evaluations.turnaround.p90Hours ?? "—"}h
              </div>
              <div className="mt-2">
                <Sparkline values={seriesFor("evaluationsCompletedNew")} />
              </div>
            </Card>
            <Card>
              <div className="text-xs uppercase tracking-wide text-white/60">Email fail rate</div>
              <div className="mt-1 text-2xl font-semibold">{pct(data.reliability.email.failRatePct)}</div>
              <div className="mt-2 text-sm text-white/70">
                sent: {data.reliability.email.totals.sent} · failed: {data.reliability.email.totals.failed}
              </div>
              <div className="mt-2">
                <Sparkline values={seriesFor("emailFailRatePct")} />
              </div>
              <div className="mt-2 text-sm">
                <Link href="/admin/email?status=failed" className="text-indigo-300 hover:text-indigo-200 hover:underline">
                  Open failures →
                </Link>
              </div>
            </Card>
          </div>

          {data.alerts?.length ? (
            <Card>
              <div className="text-sm font-semibold">Alerts</div>
              <div className="mt-3 grid gap-2">
                {data.alerts.map((a) => (
                  <div key={a.id} className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${a.level === "red" ? "bg-red-500/15 text-red-200" : a.level === "yellow" ? "bg-amber-500/15 text-amber-200" : "bg-white/10 text-white/70"}`}>
                          {a.level.toUpperCase()}
                        </span>
                        <div className="text-sm font-semibold text-white">{a.title}</div>
                      </div>
                      <div className="mt-1 text-sm text-white/80">{a.message}</div>
                    </div>
                    {a.href ? (
                      <Link href={a.href} className="text-sm text-indigo-300 hover:text-indigo-200 hover:underline">
                        Open →
                      </Link>
                    ) : null}
                  </div>
                ))}
              </div>
            </Card>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">Users</div>
                  <div className="mt-1 text-sm text-white/70">New users and active users by role.</div>
                </div>
              </div>
              <div className="mt-4 overflow-x-auto rounded-2xl border border-white/10">
                <table className="min-w-full border-collapse text-sm">
                  <thead className="bg-white/5 text-left text-white/70">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Role</th>
                      <th className="px-4 py-3 font-semibold">Total</th>
                      <th className="px-4 py-3 font-semibold">New</th>
                      <th className="px-4 py-3 font-semibold">DAU</th>
                      <th className="px-4 py-3 font-semibold">WAU</th>
                      <th className="px-4 py-3 font-semibold">MAU</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {["player", "coach", "evaluator", "admin"].map((r) => (
                      <tr key={r}>
                        <td className="px-4 py-3 font-semibold text-white">{r}</td>
                        <td className="px-4 py-3 text-white/80">{data.users.totalsByRole[r] ?? 0}</td>
                        <td className="px-4 py-3 text-white/80">{data.users.newUsersByRole[r] ?? 0}</td>
                        <td className="px-4 py-3 text-white/80">{data.users.active.dauByRole[r] ?? 0}</td>
                        <td className="px-4 py-3 text-white/80">{data.users.active.wauByRole[r] ?? 0}</td>
                        <td className="px-4 py-3 text-white/80">{data.users.active.mauByRole[r] ?? 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-3 text-xs text-white/60"></div>
            </Card>

            <Card>
              <div className="text-sm font-semibold">Profiles</div>
              <div className="mt-1 text-sm text-white/70">Completion scores and discoverability.</div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-xs uppercase tracking-wide text-white/60">Player public rate</div>
                  <div className="mt-1 text-2xl font-semibold">{pct(data.users.profiles.playerPublicRatePct)}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-xs uppercase tracking-wide text-white/60">Coach conversion</div>
                  <div className="mt-1 text-2xl font-semibold">{pct(data.users.coaches.conversionRatePct)}</div>
                  <div className="mt-2 text-sm text-white/70">active: {data.users.coaches.active} / {data.users.coaches.total}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-xs uppercase tracking-wide text-white/60">Player completion</div>
                  <div className="mt-1 text-2xl font-semibold">{data.users.profiles.playerCompletion.avgScore ?? "—"}</div>
                  <div className="mt-2 text-sm text-white/70">≥80%: {pct(data.users.profiles.playerCompletion.pctAtLeast80)}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-xs uppercase tracking-wide text-white/60">Coach completion</div>
                  <div className="mt-1 text-2xl font-semibold">{data.users.profiles.coachCompletion.avgScore ?? "—"}</div>
                  <div className="mt-2 text-sm text-white/70">≥80%: {pct(data.users.profiles.coachCompletion.pctAtLeast80)}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:col-span-2">
                  <div className="text-xs uppercase tracking-wide text-white/60">Evaluator completion</div>
                  <div className="mt-1 text-2xl font-semibold">{data.users.profiles.evaluatorCompletion.avgScore ?? "—"}</div>
                  <div className="mt-2 text-sm text-white/70">≥80%: {pct(data.users.profiles.evaluatorCompletion.pctAtLeast80)}</div>
                </div>
              </div>
            </Card>
          </div>

          {data.dataQuality ? (
            <Card>
              <div className="text-sm font-semibold">Data quality</div>
              <div className="mt-1 text-sm text-white/70">Sanity checks to ensure metrics are trustworthy.</div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-xs uppercase tracking-wide text-white/60">Event schema</div>
                  <div className="mt-1 text-2xl font-semibold">{data.dataQuality.appEventSchemaVersion}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-xs uppercase tracking-wide text-white/60">Last Stripe webhook</div>
                  <div className="mt-1 text-sm text-white/80">{data.dataQuality.lastStripeWebhookAt ? new Date(data.dataQuality.lastStripeWebhookAt).toLocaleString() : "—"}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-xs uppercase tracking-wide text-white/60">Snapshots (14d)</div>
                  <div className="mt-1 text-2xl font-semibold">{data.dataQuality.snapshotsLast14Days.length}</div>
                </div>
              </div>
              <div className="mt-4 grid gap-4 lg:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-xs uppercase tracking-wide text-white/60">App events/day (14d)</div>
                  <div className="mt-2 text-sm text-white/80">
                    {data.dataQuality.appEventsLast14Days.map((r) => (
                      <div key={r.day} className="flex justify-between gap-3">
                        <span className="text-white/70">{r.day}</span>
                        <span className="text-white">{r.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-xs uppercase tracking-wide text-white/60">DAU rows/day (14d)</div>
                  <div className="mt-2 text-sm text-white/80">
                    {data.dataQuality.dailyActiveRowsLast14Days.map((r) => (
                      <div key={r.day} className="flex justify-between gap-3">
                        <span className="text-white/70">{r.day}</span>
                        <span className="text-white">{r.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-xs uppercase tracking-wide text-white/60">Snapshots/day (14d)</div>
                  <div className="mt-2 text-sm text-white/80">
                    {data.dataQuality.snapshotsLast14Days.map((r) => (
                      <div key={r.day} className="flex justify-between gap-3">
                        <span className="text-white/70">{r.day}</span>
                        <span className="text-white">{r.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <div className="text-sm font-semibold">Engagement</div>
              <div className="mt-1 text-sm text-white/70">Search, watchlist, contact requests, messages, evaluation opens.</div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-xs uppercase tracking-wide text-white/60">Coach searches</div>
                  <div className="mt-1 text-2xl font-semibold">{data.engagement.coachSearch.total}</div>
                  <div className="mt-2 text-sm text-white/70">unique coaches: {data.engagement.coachSearch.uniqueCoaches}</div>
                  <div className="mt-2">
                    <Sparkline values={seriesFor("coachSearchEvents")} />
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-xs uppercase tracking-wide text-white/60">Watchlist adds</div>
                  <div className="mt-1 text-2xl font-semibold">{data.engagement.watchlist.addsNew}</div>
                  <div className="mt-2 text-sm text-white/70">total items: {data.engagement.watchlist.totalItems}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-xs uppercase tracking-wide text-white/60">Contact requests</div>
                  <div className="mt-1 text-2xl font-semibold">{data.engagement.contactRequests.total}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-xs uppercase tracking-wide text-white/60">Messages sent</div>
                  <div className="mt-1 text-2xl font-semibold">{data.engagement.messages.sent}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:col-span-2">
                  <div className="text-xs uppercase tracking-wide text-white/60">Coach evaluation opens</div>
                  <div className="mt-1 text-2xl font-semibold">{data.engagement.evaluationViews.coachOpens}</div>
                  <div className="mt-2 text-xs text-white/60"></div>
                </div>
              </div>
            </Card>

            <Card>
              <div className="text-sm font-semibold">Evaluator throughput (top)</div>
              <div className="mt-1 text-sm text-white/70">Counts and scoring distribution by evaluator (from reports).</div>
              <div className="mt-4 overflow-x-auto rounded-2xl border border-white/10">
                <table className="min-w-full border-collapse text-sm">
                  <thead className="bg-white/5 text-left text-white/70">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Evaluator</th>
                      <th className="px-4 py-3 font-semibold">Reports</th>
                      <th className="px-4 py-3 font-semibold">Avg grade</th>
                      <th className="px-4 py-3 font-semibold">Std dev</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {data.evaluations.evaluatorThroughput.slice(0, 15).map((r) => (
                      <tr key={r.evaluatorUserId ?? "unknown"}>
                        <td className="px-4 py-3 text-white/80">{r.evaluatorName ?? r.evaluatorEmail ?? r.evaluatorUserId ?? "—"}</td>
                        <td className="px-4 py-3 text-white/80">{r.count}</td>
                        <td className="px-4 py-3 text-white/80">{r.avgGrade ?? "—"}</td>
                        <td className="px-4 py-3 text-white/80">{r.stddev ?? "—"}</td>
                      </tr>
                    ))}
                    {data.evaluations.evaluatorThroughput.length === 0 ? (
                      <tr>
                        <td className="px-4 py-6 text-white/70" colSpan={4}>
                          No evaluator reports in this timeframe.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <div className="text-sm font-semibold">Coach funnel (unique)</div>
              <div className="mt-1 text-sm text-white/70">Search → watchlist → contact request → checkout → activated.</div>
              <div className="mt-4 grid gap-3 sm:grid-cols-5">
                {[
                  ["Search", "searched", data.engagement.coachFunnel?.searched ?? 0],
                  ["Watchlist", "watchlist", data.engagement.coachFunnel?.watchlistAdded ?? 0],
                  ["Contact", "contact", data.engagement.coachFunnel?.contactRequested ?? 0],
                  ["Checkout", "checkout", data.engagement.coachFunnel?.checkoutStarted ?? 0],
                  ["Activated", "activated", data.engagement.coachFunnel?.activated ?? 0]
                ].map(([label, stage, v]) => (
                  <Link
                    key={String(label)}
                    href={`/admin/metrics/funnel?stage=${encodeURIComponent(String(stage))}&days=${encodeURIComponent(String(days))}`}
                    className="rounded-2xl border border-white/10 bg-white/5 p-4 hover:bg-white/10"
                  >
                    <div className="text-xs uppercase tracking-wide text-white/60">{label}</div>
                    <div className="mt-1 text-2xl font-semibold">{Number(v)}</div>
                    <div className="mt-2 text-xs text-indigo-300">View coaches →</div>
                  </Link>
                ))}
              </div>
            </Card>

            <Card>
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold">SLA / overdue</div>
                <Link href="/admin/evaluations" className="text-sm text-indigo-300 hover:text-indigo-200 hover:underline">
                  Open queue →
                </Link>
              </div>
              <div className="mt-1 text-sm text-white/70">Oldest open submissions (overdue threshold: {data.ops?.overdueHours ?? "—"}h).</div>
              <div className="mt-4 overflow-x-auto rounded-2xl border border-white/10">
                <table className="min-w-full border-collapse text-sm">
                  <thead className="bg-white/5 text-left text-white/70">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Film</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 font-semibold">Assigned</th>
                      <th className="px-4 py-3 font-semibold">Open</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {(data.ops?.overdueItems ?? []).map((r) => (
                      <tr key={r.id}>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-white">{r.title}</div>
                          <div className="mt-1 text-xs text-white/60">{r.playerName ? `${r.playerName}${r.playerSport ? ` · ${r.playerSport}` : ""}${r.playerPosition ? ` · ${r.playerPosition}` : ""}` : ""}</div>
                        </td>
                        <td className="px-4 py-3 text-white/80">{r.status}</td>
                        <td className="px-4 py-3 text-white/70">{r.assignedEvaluator?.email ?? "—"}</td>
                        <td className="px-4 py-3">
                          <Link href={`/admin/evaluations/${encodeURIComponent(r.id)}`} className="text-indigo-300 hover:text-indigo-200 hover:underline">
                            Open
                          </Link>
                        </td>
                      </tr>
                    ))}
                    {(data.ops?.overdueItems ?? []).length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-6 text-white/70">
                          No open submissions found.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
              <div className="mt-3 text-sm">
                <Link href="/admin/evaluations" className="text-indigo-300 hover:text-indigo-200 hover:underline">
                  Manage assignments in Evaluations →
                </Link>
              </div>
            </Card>
          </div>

          <Card>
            <div className="text-sm font-semibold">Evaluator workload</div>
            <div className="mt-1 text-sm text-white/70">Open assignments + overdue by evaluator (plus completed count in timeframe).</div>
            <div className="mt-4 overflow-x-auto rounded-2xl border border-white/10">
              <table className="min-w-full border-collapse text-sm">
                <thead className="bg-white/5 text-left text-white/70">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Evaluator</th>
                    <th className="px-4 py-3 font-semibold">Open assigned</th>
                    <th className="px-4 py-3 font-semibold">Overdue</th>
                    <th className="px-4 py-3 font-semibold">Oldest age (h)</th>
                    <th className="px-4 py-3 font-semibold">Completed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {(data.ops?.evaluatorWorkload ?? []).slice(0, 25).map((r) => (
                    <tr key={r.evaluatorUserId}>
                      <td className="px-4 py-3 text-white/80">{r.evaluatorName ?? r.evaluatorEmail ?? r.evaluatorUserId}</td>
                      <td className="px-4 py-3 text-white/80">{r.openAssigned}</td>
                      <td className="px-4 py-3 text-white/80">{r.overdueAssigned}</td>
                      <td className="px-4 py-3 text-white/80">{r.oldestAgeHours ?? "—"}</td>
                      <td className="px-4 py-3 text-white/80">{r.completedInWindow}</td>
                    </tr>
                  ))}
                  {(data.ops?.evaluatorWorkload ?? []).length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-white/70">
                        No evaluator assignments found.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <div className="text-sm font-semibold">Showcases revenue (paid)</div>
              <div className="mt-1 text-sm text-white/70">Based on paid registrations × showcase cost.</div>
              <div className="mt-4 grid gap-3">
                {data.revenue.showcases.map((r) => (
                  <div key={r.currency} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold">{r.currency.toUpperCase()}</div>
                      <div className="text-sm text-white/70">{r.paidCount} paid</div>
                    </div>
                    <div className="mt-2 text-2xl font-semibold">{money(r.revenueCents, r.currency)}</div>
                  </div>
                ))}
                {data.revenue.showcases.length === 0 ? <div className="text-sm text-white/70">No paid registrations in this timeframe.</div> : null}
              </div>
            </Card>

            <Card>
              <div className="text-sm font-semibold">Knowledge Base</div>
              <div className="mt-1 text-sm text-white/70">Top viewed and least helpful articles.</div>
              <div className="mt-4 grid gap-4">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-xs uppercase tracking-wide text-white/60">Feedback</div>
                  <div className="mt-1 text-sm text-white/80">
                    Helpful: <span className="font-semibold text-white">{data.reliability.kb.feedback.yes}</span> · Not helpful:{" "}
                    <span className="font-semibold text-white">{data.reliability.kb.feedback.no}</span> · Total:{" "}
                    <span className="font-semibold text-white">{data.reliability.kb.feedback.total}</span>
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-white/60">Top viewed</div>
                  <div className="mt-2 grid gap-2 text-sm">
                    {data.reliability.kb.topViewed.map((a) => (
                      <div key={a.slug} className="flex items-center justify-between gap-3">
                        <Link href={`/kb/${encodeURIComponent(a.slug)}`} className="text-indigo-300 hover:text-indigo-200 hover:underline">
                          {a.slug}
                        </Link>
                        <div className="text-white/70">{a.views}</div>
                      </div>
                    ))}
                    {data.reliability.kb.topViewed.length === 0 ? <div className="text-white/70">No KB views recorded yet.</div> : null}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-white/60">Most “Not helpful”</div>
                  <div className="mt-2 grid gap-2 text-sm">
                    {data.reliability.kb.mostNotHelpful.slice(0, 8).map((a) => (
                      <div key={a.slug} className="flex items-center justify-between gap-3">
                        <Link href={`/kb/${encodeURIComponent(a.slug)}`} className="text-indigo-300 hover:text-indigo-200 hover:underline">
                          {a.title}
                        </Link>
                        <div className="text-white/70">
                          no: {a.helpfulNoCount} · yes: {a.helpfulYesCount}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </>
      ) : null}

      {configOpen ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-white/10 bg-[var(--surface)]">
            <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
              <div className="text-sm font-semibold">Targets / thresholds</div>
              <button
                type="button"
                onClick={() => setConfigOpen(false)}
                className="rounded-md border border-white/15 bg-white/5 px-3 py-1.5 text-sm text-white hover:bg-white/10"
              >
                Close
              </button>
            </div>
            <div className="max-h-[75vh] overflow-y-auto px-5 py-4">
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  ["overdueHours", "Overdue hours", config?.overdueHours],
                  ["tatP90WarnHours", "TAT p90 warn (h)", config?.tatP90WarnHours],
                  ["tatP90CritHours", "TAT p90 crit (h)", config?.tatP90CritHours],
                  ["emailFailWarnPct", "Email fail warn (%)", config?.emailFailWarnPct],
                  ["emailFailCritPct", "Email fail crit (%)", config?.emailFailCritPct],
                  ["coachConversionTargetPct", "Coach conversion target (%)", config?.coachConversionTargetPct],
                  ["playerPublicTargetPct", "Player public target (%)", config?.playerPublicTargetPct],
                  ["profileCompletionTargetPctAtLeast80", "Profile ≥80% target (%)", config?.profileCompletionTargetPctAtLeast80]
                ].map(([k, label, v]) => (
                  <label key={String(k)} className="grid gap-1 text-sm">
                    <div className="text-xs text-white/60">{label}</div>
                    <input
                      className="w-full rounded-md border border-white/15 bg-white/5 px-3 py-2 text-sm text-white"
                      defaultValue={v ?? ""}
                      onChange={(e) => setConfig((prev: any) => ({ ...(prev ?? {}), [k]: Number(e.target.value) }))}
                      inputMode="numeric"
                    />
                  </label>
                ))}
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  disabled={savingConfig}
                  onClick={() => void saveConfig(config ?? {})}
                  className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60"
                >
                  {savingConfig ? "Saving…" : "Save"}
                </button>
              </div>
              <div className="mt-3 text-xs text-white/60">These thresholds drive red/yellow/green flags and SLA definitions.</div>
            </div>
          </div>
        </div>
      ) : null}

      {snapshotEmailOpen ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-white/10 bg-[var(--surface)]">
            <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
              <div className="text-sm font-semibold">Email metrics snapshot</div>
              <button
                type="button"
                onClick={() => setSnapshotEmailOpen(false)}
                className="rounded-md border border-white/15 bg-white/5 px-3 py-1.5 text-sm text-white hover:bg-white/10"
              >
                Close
              </button>
            </div>
            <div className="px-5 py-4">
              <div className="text-sm text-white/70">Recipients (comma-separated)</div>
              <input
                className="mt-2 w-full rounded-md border border-white/15 bg-white/5 px-3 py-2 text-sm text-white"
                value={snapshotEmailTo}
                onChange={(e) => setSnapshotEmailTo(e.target.value)}
                placeholder="leader1@…, leader2@…"
              />
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  disabled={sendingSnapshotEmail}
                  onClick={() => void sendSnapshotEmail()}
                  className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60"
                >
                  {sendingSnapshotEmail ? "Sending…" : "Send"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}


