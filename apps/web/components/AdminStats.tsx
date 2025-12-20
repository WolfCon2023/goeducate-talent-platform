"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Card, Button } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { getAccessToken, getTokenRole } from "@/lib/auth";

type AdminStatsResponse = {
  submissions: { total: number; byStatus: Record<string, number> };
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
  };
};

export function AdminStats() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AdminStatsResponse | null>(null);

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


