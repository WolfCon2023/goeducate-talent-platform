"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Card, Button } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { getAccessToken, getTokenRole } from "@/lib/auth";

type AdminStatsResponse = {
  players?: {
    total: number;
    bySport: Array<{ sport: string; count: number }>;
    byPosition: Array<{ position: string; count: number }>;
  };
  submissions: {
    total: number;
    byStatus: Record<string, number>;
    bySport?: Array<{ sport: string; count: number }>;
    byPosition?: Array<{ position: string; count: number }>;
  };
  evaluations: {
    total: number;
    byGrade: Array<{
      grade: number;
      count: number;
      items: Array<{
        evaluationId: string;
        createdAt?: string;
        filmSubmissionId?: string;
        filmTitle?: string;
        playerUserId?: string;
        playerFirstName?: string;
        playerLastName?: string;
      }>;
    }>;
    bySportPosition?: Array<{
      sport: string;
      position: string;
      count: number;
      avgGrade?: number;
      avgTurnaroundHours?: number;
    }>;
    evaluators?: Array<{
      evaluatorUserId: string;
      count: number;
      avgGrade?: number;
      avgTurnaroundHours?: number;
      user?: { id?: string; email?: string; role?: string; firstName?: string; lastName?: string };
    }>;
  };
};

export function AdminStats() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AdminStatsResponse | null>(null);

  function fmtHours(hours?: number | null) {
    if (typeof hours !== "number" || !Number.isFinite(hours)) return "—";
    const totalHours = Math.max(0, hours);
    const d = Math.floor(totalHours / 24);
    const h = Math.round(totalHours % 24);
    if (d <= 0) return `${Math.round(totalHours)}h`;
    return `${d}d ${h}h`;
  }

  async function load() {
    setError(null);
    setLoading(true);
    try {
      const token = getAccessToken();
      const role = getTokenRole(token);
      if (!token) throw new Error("Please login first.");
      if (role !== "admin") throw new Error("Insufficient permissions.");
      const res = await apiFetch<AdminStatsResponse>("/admin/stats", { token });
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load stats");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const byStatus = data?.submissions.byStatus ?? {};
  const players = data?.players;
  const submissionsBySport: Array<{ sport: string; count: number }> = data?.submissions.bySport ?? [];
  const submissionsByPosition: Array<{ position: string; count: number }> = data?.submissions.byPosition ?? [];
  const evalBySportPosition: Array<{
    sport: string;
    position: string;
    count: number;
    avgGrade?: number;
    avgTurnaroundHours?: number;
  }> = data?.evaluations.bySportPosition ?? [];
  const evaluatorPerf: Array<{
    evaluatorUserId: string;
    count: number;
    avgGrade?: number;
    avgTurnaroundHours?: number;
    user?: { id?: string; email?: string; role?: string; firstName?: string; lastName?: string };
  }> = data?.evaluations.evaluators ?? [];

  return (
    <Card>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Dashboard</h2>
          <p className="mt-1 text-sm text-[color:var(--muted)]">Submission and evaluation activity overview.</p>
        </div>
        <Button type="button" onClick={load} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh"}
        </Button>
      </div>

      {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}

      {data ? (
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-[color:var(--border)] bg-[var(--surface-soft)] p-4">
            <div className="text-xs uppercase tracking-wide text-[color:var(--muted-2)]">Submissions</div>
            <div className="mt-1 text-2xl font-semibold">{data.submissions.total}</div>
            <div className="mt-2 text-sm text-[color:var(--muted)]">
              submitted: {byStatus.submitted ?? 0} · in_review: {byStatus.in_review ?? 0} · completed:{" "}
              {byStatus.completed ?? 0}
            </div>
          </div>
          <div className="rounded-2xl border border-[color:var(--border)] bg-[var(--surface-soft)] p-4">
            <div className="text-xs uppercase tracking-wide text-[color:var(--muted-2)]">Evaluations</div>
            <div className="mt-1 text-2xl font-semibold">{data.evaluations.total}</div>
            <div className="mt-2 text-sm text-[color:var(--muted)]">Grouped by rating below.</div>
          </div>
          <div className="rounded-2xl border border-[color:var(--border)] bg-[var(--surface-soft)] p-4">
            <div className="text-xs uppercase tracking-wide text-[color:var(--muted-2)]">Players</div>
            <div className="mt-1 text-2xl font-semibold">{players?.total ?? "—"}</div>
            <div className="mt-2 text-sm text-[color:var(--muted)]">Breakdowns by sport/position below.</div>
          </div>
        </div>
      ) : null}

      {data ? (
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-[color:var(--border)] bg-[var(--surface)] p-4">
            <div className="text-sm font-semibold text-[color:var(--foreground)]">Players by sport</div>
            <div className="mt-3 grid gap-1 text-sm text-[color:var(--muted)]">
              {(players?.bySport ?? []).slice(0, 10).map((r) => (
                <div key={r.sport} className="flex items-center justify-between gap-3">
                  <div className="text-[color:var(--foreground)]">{r.sport}</div>
                  <div>{r.count}</div>
                </div>
              ))}
              {(players?.bySport ?? []).length === 0 ? <div>—</div> : null}
            </div>
          </div>
          <div className="rounded-2xl border border-[color:var(--border)] bg-[var(--surface)] p-4">
            <div className="text-sm font-semibold text-[color:var(--foreground)]">Players by position</div>
            <div className="mt-3 grid gap-1 text-sm text-[color:var(--muted)]">
              {(players?.byPosition ?? []).slice(0, 10).map((r) => (
                <div key={r.position} className="flex items-center justify-between gap-3">
                  <div className="text-[color:var(--foreground)]">{r.position}</div>
                  <div>{r.count}</div>
                </div>
              ))}
              {(players?.byPosition ?? []).length === 0 ? <div>—</div> : null}
            </div>
          </div>
          <div className="rounded-2xl border border-[color:var(--border)] bg-[var(--surface)] p-4">
            <div className="text-xs uppercase tracking-wide text-[color:var(--muted-2)]">Quick links</div>
            <div className="mt-2 grid gap-2 text-sm">
              <Link className="text-indigo-300 hover:text-indigo-200 hover:underline" href="/evaluator">
                Evaluator queue
              </Link>
              <Link className="text-indigo-300 hover:text-indigo-200 hover:underline" href="/coach">
                Coach portal
              </Link>
              <Link className="text-indigo-300 hover:text-indigo-200 hover:underline" href="/notifications">
                Notifications
              </Link>
            </div>
          </div>
        </div>
      ) : null}

      {data ? (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-[color:var(--border)] bg-[var(--surface)] p-4">
            <div className="text-sm font-semibold text-[color:var(--foreground)]">Submissions by sport</div>
            <div className="mt-3 grid gap-1 text-sm text-[color:var(--muted)]">
              {submissionsBySport.slice(0, 12).map((r) => (
                <div key={r.sport} className="flex items-center justify-between gap-3">
                  <div className="text-[color:var(--foreground)]">{r.sport}</div>
                  <div>{r.count}</div>
                </div>
              ))}
              {submissionsBySport.length === 0 ? <div>—</div> : null}
            </div>
          </div>
          <div className="rounded-2xl border border-[color:var(--border)] bg-[var(--surface)] p-4">
            <div className="text-sm font-semibold text-[color:var(--foreground)]">Submissions by position</div>
            <div className="mt-3 grid gap-1 text-sm text-[color:var(--muted)]">
              {submissionsByPosition.slice(0, 12).map((r) => (
                <div key={r.position} className="flex items-center justify-between gap-3">
                  <div className="text-[color:var(--foreground)]">{r.position}</div>
                  <div>{r.count}</div>
                </div>
              ))}
              {submissionsByPosition.length === 0 ? <div>—</div> : null}
            </div>
          </div>
        </div>
      ) : null}

      {data ? (
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-[color:var(--foreground)]">Evaluations by sport / position</h3>
          <div className="mt-3 overflow-x-auto rounded-2xl border border-[color:var(--border)] bg-[var(--surface)]">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-[color:var(--border)] text-[color:var(--muted-2)]">
                <tr>
                  <th className="px-4 py-3 font-medium">Sport</th>
                  <th className="px-4 py-3 font-medium">Position</th>
                  <th className="px-4 py-3 font-medium">Count</th>
                  <th className="px-4 py-3 font-medium">Avg grade</th>
                  <th className="px-4 py-3 font-medium">Avg turnaround</th>
                </tr>
              </thead>
              <tbody>
                {evalBySportPosition.slice(0, 30).map((r) => (
                  <tr key={`${r.sport}::${r.position}`} className="border-b border-[color:var(--border)] last:border-0">
                    <td className="px-4 py-3 text-[color:var(--foreground)]">{r.sport}</td>
                    <td className="px-4 py-3 text-[color:var(--foreground)]">{r.position}</td>
                    <td className="px-4 py-3 text-[color:var(--muted)]">{r.count}</td>
                    <td className="px-4 py-3 text-[color:var(--muted)]">
                      {typeof r.avgGrade === "number" ? `${r.avgGrade.toFixed(2)}/10` : "—"}
                    </td>
                    <td className="px-4 py-3 text-[color:var(--muted)]">{fmtHours(r.avgTurnaroundHours)}</td>
                  </tr>
                ))}
                {evalBySportPosition.length === 0 ? (
                  <tr>
                    <td className="px-4 py-4 text-[color:var(--muted)]" colSpan={5}>
                      —</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {data ? (
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-[color:var(--foreground)]">Evaluator performance</h3>
          <div className="mt-3 overflow-x-auto rounded-2xl border border-[color:var(--border)] bg-[var(--surface)]">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-[color:var(--border)] text-[color:var(--muted-2)]">
                <tr>
                  <th className="px-4 py-3 font-medium">Evaluator</th>
                  <th className="px-4 py-3 font-medium">Count</th>
                  <th className="px-4 py-3 font-medium">Avg grade</th>
                  <th className="px-4 py-3 font-medium">Avg turnaround</th>
                </tr>
              </thead>
              <tbody>
                {evaluatorPerf.slice(0, 30).map((r) => {
                  const name =
                    r.user?.firstName || r.user?.lastName
                      ? `${r.user?.firstName ?? ""} ${r.user?.lastName ?? ""}`.trim()
                      : null;
                  const label = name ? `${name}${r.user?.email ? ` (${r.user.email})` : ""}` : r.user?.email ?? r.evaluatorUserId;
                  return (
                    <tr key={r.evaluatorUserId} className="border-b border-[color:var(--border)] last:border-0">
                      <td className="px-4 py-3 text-[color:var(--foreground)]">{label}</td>
                      <td className="px-4 py-3 text-[color:var(--muted)]">{r.count}</td>
                      <td className="px-4 py-3 text-[color:var(--muted)]">
                        {typeof r.avgGrade === "number" ? `${r.avgGrade.toFixed(2)}/10` : "—"}
                      </td>
                      <td className="px-4 py-3 text-[color:var(--muted)]">{fmtHours(r.avgTurnaroundHours)}</td>
                    </tr>
                  );
                })}
                {evaluatorPerf.length === 0 ? (
                  <tr>
                    <td className="px-4 py-4 text-[color:var(--muted)]" colSpan={4}>
                      —</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {data ? (
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-[color:var(--foreground)]">Evaluations by rating</h3>
          <div className="mt-3 grid gap-3">
            {data.evaluations.byGrade.map((g) => (
              <div key={g.grade} className="rounded-2xl border border-[color:var(--border)] bg-[var(--surface)] p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="font-semibold">Rating {g.grade}/10</div>
                  <div className="text-sm text-[color:var(--muted)]">{g.count} evaluations</div>
                </div>
                {g.items.length > 0 ? (
                  <div className="mt-3 grid gap-2 text-sm text-[color:var(--muted)]">
                    {g.items.map((it) => {
                      const playerName =
                        it.playerFirstName || it.playerLastName
                          ? `${it.playerFirstName ?? ""} ${it.playerLastName ?? ""}`.trim()
                          : "Player";
                      return (
                        <div key={it.evaluationId} className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <span className="text-[color:var(--foreground)]">{playerName}</span>
                            {it.filmTitle ? <span> · {it.filmTitle}</span> : null}
                          </div>
                          {it.playerUserId ? (
                            <Link
                              className="text-indigo-300 hover:text-indigo-200 hover:underline"
                              href={`/coach/player/${it.playerUserId}`}
                            >
                              View player
                            </Link>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-[color:var(--muted)]">No evaluations yet.</p>
                )}
              </div>
            ))}
            {data.evaluations.byGrade.length === 0 ? (
              <p className="text-sm text-[color:var(--muted)]">No evaluations yet.</p>
            ) : null}
          </div>
        </div>
      ) : null}
    </Card>
  );
}


