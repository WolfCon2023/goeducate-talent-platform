"use client";

import Link from "next/link";
import * as React from "react";

import { Card } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { getAccessToken, getTokenRole, getTokenSub } from "@/lib/auth";

type FilmSubmission = { _id: string; title: string; status: string; createdAt?: string };
type EvaluationReport = { filmSubmissionId: string; overallGrade: number; createdAt?: string };

function fmtDate(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString();
}

export function PlayerEvaluationHistoryWidget() {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [items, setItems] = React.useState<Array<{ filmId: string; filmTitle: string; grade: number; createdAt?: string }>>([]);

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      setError(null);
      setLoading(true);
      try {
        const token = getAccessToken();
        const role = getTokenRole(token);
        const sub = getTokenSub(token);
        if (!token) throw new Error("Please login first.");
        if (role && role !== "player") return;
        if (!sub) throw new Error("Missing user id.");

        const [filmsRes, evalRes] = await Promise.all([
          apiFetch<{ results: FilmSubmission[] }>("/film-submissions/me", { token }),
          apiFetch<{ results: EvaluationReport[] }>(`/evaluations/player/${encodeURIComponent(sub)}`, { token })
        ]);

        const films = filmsRes.results ?? [];
        const byId = new Map(films.map((f) => [f._id, f]));
        const rows = (evalRes.results ?? [])
          .map((r) => {
            const f = byId.get(String(r.filmSubmissionId));
            return {
              filmId: String(r.filmSubmissionId),
              filmTitle: f?.title ?? "Film submission",
              grade: Number(r.overallGrade ?? 0),
              createdAt: r.createdAt
            };
          })
          .filter((r) => r.grade > 0)
          .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));

        if (!cancelled) setItems(rows.slice(0, 5));
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load evaluation history");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const avg = React.useMemo(() => {
    if (!items.length) return null;
    const sum = items.reduce((a, b) => a + b.grade, 0);
    return Math.round((sum / items.length) * 100) / 100;
  }, [items]);

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-sm font-semibold">Recent evaluations</div>
          <div className="mt-1 text-sm text-white/80">Your latest completed evaluations.</div>
        </div>
        {avg != null ? <div className="text-sm text-white/80">Avg: <span className="font-semibold text-white">{avg}</span>/10</div> : null}
      </div>

      {error ? <div className="mt-3 text-sm text-red-300">{error}</div> : null}
      {loading ? <div className="mt-3 text-sm text-white/80">Loading…</div> : null}

      {!loading && !error ? (
        <div className="mt-4 grid gap-3">
          {items.map((it) => (
            <div key={it.filmId} className="rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="font-semibold text-white">{it.filmTitle}</div>
                  <div className="mt-1 text-sm text-white/70">
                    Grade: <span className="font-semibold text-white">{it.grade}</span>/10 · {fmtDate(it.createdAt)}
                  </div>
                </div>
                <Link href={`/player/film/${encodeURIComponent(it.filmId)}?view=evaluation`} className="text-sm text-indigo-300 hover:text-indigo-200 hover:underline">
                  Open
                </Link>
              </div>
            </div>
          ))}
          {items.length === 0 ? <div className="text-sm text-white/70">No evaluations yet.</div> : null}
        </div>
      ) : null}
    </Card>
  );
}


